import { secureTokenStore } from "./secure-token-store";

export interface WSEvent<T = unknown> {
  type: string;
  data: T;
}

export interface TranscodeProgressData {
  media_id: number;
  progress: number;
  status: string;
}

export interface ScanProgressData {
  session_id: string;
  found: number;
  processed: number;
  status: string;
}

export interface EmissionStatusData {
  channel_id: number;
  status: string;
}

type EventHandler = (event: WSEvent) => void;

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const PING_INTERVAL = 50000; // 50s, server pong wait is 60s

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<EventHandler>>();
  private globalListeners = new Set<EventHandler>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private intentionalClose = false;

  connect(): void {
    const token = secureTokenStore.getToken();
    if (!token) return;

    this.intentionalClose = false;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.startPing();
    };

    this.ws.onmessage = (ev) => {
      try {
        const event: WSEvent = JSON.parse(ev.data);
        this.dispatch(event);
      } catch {
        // ignore non-JSON messages
      }
    };

    this.ws.onclose = () => {
      this.stopPing();
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to events of a specific type.
   * Returns an unsubscribe function.
   */
  on<T = unknown>(type: string, handler: (event: WSEvent<T>) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler as EventHandler);
    return () => {
      this.listeners.get(type)?.delete(handler as EventHandler);
    };
  }

  /**
   * Subscribe to all events regardless of type.
   * Returns an unsubscribe function.
   */
  onAny(handler: EventHandler): () => void {
    this.globalListeners.add(handler);
    return () => {
      this.globalListeners.delete(handler);
    };
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private dispatch(event: WSEvent): void {
    // Type-specific listeners
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      handlers.forEach((h) => h(event));
    }
    // Global listeners
    this.globalListeners.forEach((h) => h(event));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts),
      RECONNECT_MAX_DELAY,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    // The server emits protocol-level PING frames that browsers auto-pong, which
    // is what actually keeps the connection alive. In addition we send a small
    // application-level keepalive so intermediate proxies with idle timeouts
    // don't drop the connection, and so we fail fast if the socket is wedged.
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      try {
        this.ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
      } catch {
        // Sending failed: tear down so scheduleReconnect() can retry.
        try {
          this.ws.close();
        } catch {
          /* noop */
        }
      }
    }, PING_INTERVAL);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

export const wsClient = new WebSocketClient();

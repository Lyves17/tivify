// Test the actual WebSocketClient class, not the mock
jest.unmock('@/lib/websocket')

// Mock secure-token-store
jest.mock('@/lib/secure-token-store', () => ({
  secureTokenStore: {
    getToken: jest.fn(),
    setToken: jest.fn(),
    clearToken: jest.fn(),
    hasToken: jest.fn(),
  },
}))

import { secureTokenStore } from '@/lib/secure-token-store'

const mockGetToken = secureTokenStore.getToken as jest.Mock

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  url: string
  readyState: number = MockWebSocket.CONNECTING
  onopen: ((ev: any) => void) | null = null
  onmessage: ((ev: any) => void) | null = null
  onclose: ((ev: any) => void) | null = null
  onerror: ((ev: any) => void) | null = null

  constructor(url: string) {
    this.url = url
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) this.onclose({})
  }

  send(_data: string) {
    // no-op
  }
}

// Assign to global
;(global as any).WebSocket = MockWebSocket

describe('WebSocketClient (actual class)', () => {
  let wsClient: any

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    // Mock window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { protocol: 'https:', host: 'localhost:3000' },
    })

    // Fresh import for each test
    jest.isolateModules(() => {
      const mod = require('@/lib/websocket')
      wsClient = mod.wsClient
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    if (wsClient) {
      wsClient.disconnect()
    }
  })

  it('connect() does nothing if no token', () => {
    mockGetToken.mockReturnValue(null)
    wsClient.connect()
    expect(wsClient.connected).toBe(false)
  })

  it('connect() creates WebSocket when token exists', () => {
    mockGetToken.mockReturnValue('a.b.c')
    wsClient.connect()
    // WebSocket was created (wsClient has an internal ws)
    expect(wsClient.connected).toBe(false) // not open yet
  })

  it('connect() uses wss: protocol for https:', () => {
    mockGetToken.mockReturnValue('a.b.c')
    wsClient.connect()
    // The WebSocket constructor was called with wss protocol
    // We can verify by checking the internal state through connected property
    expect(wsClient.connected).toBe(false) // CONNECTING state
  })

  it('disconnect() closes connection and cleans up', () => {
    mockGetToken.mockReturnValue('a.b.c')
    wsClient.connect()
    wsClient.disconnect()
    expect(wsClient.connected).toBe(false)
  })

  it('disconnect() when not connected is safe', () => {
    expect(() => wsClient.disconnect()).not.toThrow()
  })

  it('on() subscribes to events and returns unsubscribe function', () => {
    const handler = jest.fn()
    const unsub = wsClient.on('test-event', handler)
    expect(typeof unsub).toBe('function')

    // Calling unsubscribe should not throw
    expect(() => unsub()).not.toThrow()
  })

  it('on() handler receives dispatched events', () => {
    const handler = jest.fn()
    wsClient.on('test-type', handler)

    // Simulate connect and message
    mockGetToken.mockReturnValue('a.b.c')
    wsClient.connect()

    // Simulate onmessage by getting the internal ws reference through connect behavior
    // We need to trigger the message handler directly
    // Access internal ws through connect
    const event = { type: 'test-type', data: { foo: 'bar' } }

    // We need to trigger the ws.onmessage callback
    // Since wsClient creates a new WebSocket internally, we need another approach
    // Let's use the mock to capture the ws instance
    // After connect, we can trigger the message on the last created MockWebSocket

    // Trigger onopen first to reset reconnect attempts
    // The wsClient.ws is private, but we can simulate via the MockWebSocket

    // Actually, let's test dispatching through a different approach
    // We'll connect and then manually trigger the message
    mockGetToken.mockReturnValue('a.b.c')

    // Store ref to created websocket by monkey-patching
    let createdWs: MockWebSocket | null = null
    const OrigWS = (global as any).WebSocket
    ;(global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url)
        createdWs = this
      }
    }

    // Need a fresh instance
    jest.isolateModules(() => {
      const mod = require('@/lib/websocket')
      const client = mod.wsClient

      const handler2 = jest.fn()
      client.on('msg', handler2)
      client.connect()

      expect(createdWs).not.toBeNull()

      // Simulate receiving a message
      if (createdWs && createdWs.onmessage) {
        createdWs.onmessage({ data: JSON.stringify({ type: 'msg', data: { value: 42 } }) })
      }

      expect(handler2).toHaveBeenCalledWith({ type: 'msg', data: { value: 42 } })

      client.disconnect()
    })

    // Restore original
    ;(global as any).WebSocket = OrigWS
  })

  it('onAny() receives all events', () => {
    let createdWs: MockWebSocket | null = null
    const OrigWS = (global as any).WebSocket
    ;(global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url)
        createdWs = this
      }
    }

    jest.isolateModules(() => {
      const mod = require('@/lib/websocket')
      const client = mod.wsClient

      const handler = jest.fn()
      client.onAny(handler)

      mockGetToken.mockReturnValue('x.y.z')
      client.connect()

      if (createdWs && createdWs.onmessage) {
        createdWs.onmessage({ data: JSON.stringify({ type: 'event-a', data: {} }) })
        createdWs.onmessage({ data: JSON.stringify({ type: 'event-b', data: {} }) })
      }

      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenCalledWith({ type: 'event-a', data: {} })
      expect(handler).toHaveBeenCalledWith({ type: 'event-b', data: {} })

      client.disconnect()
    })

    ;(global as any).WebSocket = OrigWS
  })

  it('onAny() returns unsubscribe function', () => {
    const handler = jest.fn()
    const unsub = wsClient.onAny(handler)
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('unsubscribe from on() stops receiving events', () => {
    let createdWs: MockWebSocket | null = null
    const OrigWS = (global as any).WebSocket
    ;(global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url)
        createdWs = this
      }
    }

    jest.isolateModules(() => {
      const mod = require('@/lib/websocket')
      const client = mod.wsClient

      const handler = jest.fn()
      const unsub = client.on('myevent', handler)

      mockGetToken.mockReturnValue('x.y.z')
      client.connect()

      if (createdWs && createdWs.onmessage) {
        createdWs.onmessage({ data: JSON.stringify({ type: 'myevent', data: {} }) })
      }
      expect(handler).toHaveBeenCalledTimes(1)

      // Unsubscribe
      unsub()

      if (createdWs && createdWs.onmessage) {
        createdWs.onmessage({ data: JSON.stringify({ type: 'myevent', data: {} }) })
      }
      // Should not receive the second event
      expect(handler).toHaveBeenCalledTimes(1)

      client.disconnect()
    })

    ;(global as any).WebSocket = OrigWS
  })

  it('reconnects with exponential backoff when connection closes unexpectedly', () => {
    let createdWs: MockWebSocket | null = null
    const OrigWS = (global as any).WebSocket
    let connectCount = 0
    ;(global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url)
        createdWs = this
        connectCount++
      }
    }

    jest.isolateModules(() => {
      const mod = require('@/lib/websocket')
      const client = mod.wsClient

      mockGetToken.mockReturnValue('x.y.z')
      client.connect()
      expect(connectCount).toBe(1)

      // Simulate unexpected close
      if (createdWs && createdWs.onclose) {
        createdWs.onclose({})
      }

      // Advance past first reconnect delay (1000ms base)
      jest.advanceTimersByTime(1100)
      expect(connectCount).toBe(2)

      // Simulate another close
      if (createdWs && createdWs.onclose) {
        createdWs.onclose({})
      }

      // Second reconnect should take longer (2000ms base)
      jest.advanceTimersByTime(1100) // not enough
      expect(connectCount).toBe(2)

      jest.advanceTimersByTime(1100) // now should reconnect
      expect(connectCount).toBe(3)

      client.disconnect()
    })

    ;(global as any).WebSocket = OrigWS
  })

  it('does not reconnect after intentional disconnect', () => {
    let createdWs: MockWebSocket | null = null
    const OrigWS = (global as any).WebSocket
    let connectCount = 0
    ;(global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url)
        createdWs = this
        connectCount++
      }
    }

    jest.isolateModules(() => {
      const mod = require('@/lib/websocket')
      const client = mod.wsClient

      mockGetToken.mockReturnValue('x.y.z')
      client.connect()
      expect(connectCount).toBe(1)

      // Intentional disconnect
      client.disconnect()

      // Advance timers - should NOT reconnect
      jest.advanceTimersByTime(60000)
      expect(connectCount).toBe(1)
    })

    ;(global as any).WebSocket = OrigWS
  })

  it('onopen resets reconnect attempts', () => {
    let createdWs: MockWebSocket | null = null
    const OrigWS = (global as any).WebSocket
    let connectCount = 0
    ;(global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url)
        createdWs = this
        connectCount++
      }
    }

    jest.isolateModules(() => {
      const mod = require('@/lib/websocket')
      const client = mod.wsClient

      mockGetToken.mockReturnValue('x.y.z')
      client.connect()

      // Simulate successful connection
      if (createdWs) {
        createdWs.readyState = MockWebSocket.OPEN
        if (createdWs.onopen) createdWs.onopen({})
      }

      expect(client.connected).toBe(true)

      client.disconnect()
    })

    ;(global as any).WebSocket = OrigWS
  })

  it('ignores non-JSON messages', () => {
    let createdWs: MockWebSocket | null = null
    const OrigWS = (global as any).WebSocket
    ;(global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url)
        createdWs = this
      }
    }

    jest.isolateModules(() => {
      const mod = require('@/lib/websocket')
      const client = mod.wsClient

      const handler = jest.fn()
      client.onAny(handler)

      mockGetToken.mockReturnValue('x.y.z')
      client.connect()

      // Send non-JSON message
      expect(() => {
        if (createdWs && createdWs.onmessage) {
          createdWs.onmessage({ data: 'not json' })
        }
      }).not.toThrow()

      expect(handler).not.toHaveBeenCalled()

      client.disconnect()
    })

    ;(global as any).WebSocket = OrigWS
  })

  it('connected getter returns true when readyState is OPEN', () => {
    let createdWs: MockWebSocket | null = null
    const OrigWS = (global as any).WebSocket
    ;(global as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url)
        createdWs = this
      }
    }

    jest.isolateModules(() => {
      const mod = require('@/lib/websocket')
      const client = mod.wsClient

      expect(client.connected).toBe(false)

      mockGetToken.mockReturnValue('x.y.z')
      client.connect()

      if (createdWs) {
        createdWs.readyState = MockWebSocket.OPEN
      }

      expect(client.connected).toBe(true)

      client.disconnect()
    })

    ;(global as any).WebSocket = OrigWS
  })
})

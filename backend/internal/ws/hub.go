package ws

import (
	"encoding/json"
	"log"
	"sync"
)

// Event represents a real-time event sent to WebSocket clients.
type Event struct {
	Type string      `json:"type"` // e.g. "transcode.progress", "scan.progress", "emission.status"
	Data interface{} `json:"data"`
}

// Client represents a connected WebSocket client.
type Client struct {
	ID     string
	UserID string
	Send   chan []byte
}

// Hub maintains the set of active clients and broadcasts events.
type Hub struct {
	clients    map[*Client]bool
	mu         sync.RWMutex
	register   chan *Client
	unregister chan *Client
	stop       chan struct{}
	stopOnce   sync.Once
	stopped    chan struct{}
}

// NewHub creates a new Hub.
func NewHub() *Hub {
	return &Hub{
		clients: make(map[*Client]bool),
		// Buffered channels avoid deadlocking the HTTP handler if Run briefly
		// stalls or is being shut down.
		register:   make(chan *Client, 64),
		unregister: make(chan *Client, 64),
		stop:       make(chan struct{}),
		stopped:    make(chan struct{}),
	}
}

// Run starts the hub's event loop. Should be run in a goroutine.
// Exits cleanly when Stop() is called.
func (h *Hub) Run() {
	defer close(h.stopped)
	defer func() {
		if r := recover(); r != nil {
			log.Printf("ERROR [WS-HUB] panic recovered: %v", r)
		}
		// Drain remaining clients so their Send channels are closed.
		h.mu.Lock()
		for client := range h.clients {
			delete(h.clients, client)
			safeCloseSend(client)
		}
		h.mu.Unlock()
	}()

	for {
		select {
		case <-h.stop:
			return

		case client := <-h.register:
			if client == nil {
				continue
			}
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("[WS] Client connected: %s (user %s)", client.ID, client.UserID)

		case client := <-h.unregister:
			if client == nil {
				continue
			}
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				safeCloseSend(client)
			}
			h.mu.Unlock()
			log.Printf("[WS] Client disconnected: %s", client.ID)
		}
	}
}

// Stop signals Run() to exit and closes all client Send channels. Safe to call
// multiple times.
func (h *Hub) Stop() {
	h.stopOnce.Do(func() { close(h.stop) })
}

// Done returns a channel that is closed when Run() has fully exited.
func (h *Hub) Done() <-chan struct{} { return h.stopped }

// Register adds a client to the hub. Non-blocking: if the hub is shutting
// down or the buffer is full, the client is rejected and its Send channel is
// closed so callers see the failure as an EOF.
func (h *Hub) Register(client *Client) {
	if client == nil {
		return
	}
	select {
	case <-h.stop:
		safeCloseSend(client)
	case h.register <- client:
	default:
		// Backpressure: drop and close rather than blocking the WS handler goroutine.
		log.Printf("[WS] register buffer full, dropping client %s", client.ID)
		safeCloseSend(client)
	}
}

// Unregister removes a client from the hub. Non-blocking.
func (h *Hub) Unregister(client *Client) {
	if client == nil {
		return
	}
	select {
	case <-h.stop:
		return
	case h.unregister <- client:
	default:
		// Hub is busy; fall back to direct removal to avoid leaking the client.
		h.mu.Lock()
		if _, ok := h.clients[client]; ok {
			delete(h.clients, client)
			safeCloseSend(client)
		}
		h.mu.Unlock()
	}
}

// Broadcast sends an event to all connected clients.
func (h *Hub) Broadcast(event Event) {
	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("[WS] Error marshaling event: %v", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		select {
		case client.Send <- data:
		default:
			// Client buffer full, skip
		}
	}
}

// BroadcastToUser sends an event only to clients belonging to a specific user.
func (h *Hub) BroadcastToUser(userID string, event Event) {
	if userID == "" {
		return
	}
	data, err := json.Marshal(event)
	if err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		if client.UserID == userID {
			select {
			case client.Send <- data:
			default:
			}
		}
	}
}

// ClientCount returns the number of connected clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// safeCloseSend closes the Send channel, recovering from a possible
// "close of closed channel" panic if the client was already closed elsewhere.
func safeCloseSend(c *Client) {
	if c == nil || c.Send == nil {
		return
	}
	defer func() { _ = recover() }()
	close(c.Send)
}

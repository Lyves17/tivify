package ws

import (
	"encoding/json"
	"testing"
	"time"
)

func TestNewHub(t *testing.T) {
	hub := NewHub()
	if hub == nil {
		t.Fatal("NewHub() returned nil")
	}
	if hub.clients == nil {
		t.Error("clients map should be initialized")
	}
	if hub.register == nil {
		t.Error("register channel should be initialized")
	}
	if hub.unregister == nil {
		t.Error("unregister channel should be initialized")
	}
}

func TestHub_RegisterAndClientCount(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	client := &Client{
		ID:     "test-1",
		UserID: "user-1",
		Send:   make(chan []byte, 256),
	}

	hub.Register(client)
	// Give the goroutine time to process
	time.Sleep(50 * time.Millisecond)

	if count := hub.ClientCount(); count != 1 {
		t.Errorf("ClientCount() = %d, want 1", count)
	}
}

func TestHub_Unregister(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	client := &Client{
		ID:     "test-1",
		UserID: "user-1",
		Send:   make(chan []byte, 256),
	}

	hub.Register(client)
	time.Sleep(50 * time.Millisecond)

	hub.Unregister(client)
	time.Sleep(50 * time.Millisecond)

	if count := hub.ClientCount(); count != 0 {
		t.Errorf("ClientCount() = %d, want 0 after unregister", count)
	}
}

func TestHub_Broadcast(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	client1 := &Client{ID: "c1", UserID: "u1", Send: make(chan []byte, 256)}
	client2 := &Client{ID: "c2", UserID: "u2", Send: make(chan []byte, 256)}

	hub.Register(client1)
	hub.Register(client2)
	time.Sleep(50 * time.Millisecond)

	event := Event{Type: "test.event", Data: map[string]string{"key": "value"}}
	hub.Broadcast(event)

	// Both clients should receive the message
	select {
	case msg := <-client1.Send:
		var received Event
		if err := json.Unmarshal(msg, &received); err != nil {
			t.Fatalf("failed to unmarshal: %v", err)
		}
		if received.Type != "test.event" {
			t.Errorf("client1 got type = %q, want %q", received.Type, "test.event")
		}
	case <-time.After(time.Second):
		t.Error("client1 did not receive broadcast")
	}

	select {
	case msg := <-client2.Send:
		var received Event
		json.Unmarshal(msg, &received)
		if received.Type != "test.event" {
			t.Errorf("client2 got type = %q, want %q", received.Type, "test.event")
		}
	case <-time.After(time.Second):
		t.Error("client2 did not receive broadcast")
	}
}

func TestHub_BroadcastToUser(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	client1 := &Client{ID: "c1", UserID: "target-user", Send: make(chan []byte, 256)}
	client2 := &Client{ID: "c2", UserID: "other-user", Send: make(chan []byte, 256)}

	hub.Register(client1)
	hub.Register(client2)
	time.Sleep(50 * time.Millisecond)

	event := Event{Type: "user.event", Data: "hello"}
	hub.BroadcastToUser("target-user", event)

	// client1 should receive
	select {
	case <-client1.Send:
		// ok
	case <-time.After(time.Second):
		t.Error("target client did not receive broadcast")
	}

	// client2 should NOT receive
	select {
	case <-client2.Send:
		t.Error("non-target client should not receive broadcast")
	case <-time.After(100 * time.Millisecond):
		// ok, expected
	}
}

func TestHub_ClientCount_Empty(t *testing.T) {
	hub := NewHub()
	if count := hub.ClientCount(); count != 0 {
		t.Errorf("ClientCount() = %d, want 0 for new hub", count)
	}
}

func TestHub_Broadcast_FullBuffer(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	// Create a client with a tiny buffer
	client := &Client{ID: "c1", UserID: "u1", Send: make(chan []byte, 1)}

	hub.Register(client)
	time.Sleep(50 * time.Millisecond)

	// Fill the buffer
	client.Send <- []byte("filler")

	// Broadcast should skip the client since buffer is full (not block)
	event := Event{Type: "test.skip", Data: "should be skipped"}
	hub.Broadcast(event)

	// Read the original filler message
	msg := <-client.Send
	if string(msg) != "filler" {
		t.Errorf("expected filler message, got %q", string(msg))
	}

	// The broadcast message should have been dropped
	select {
	case <-client.Send:
		t.Error("should not have received the broadcast message when buffer was full")
	case <-time.After(100 * time.Millisecond):
		// expected
	}
}

func TestHub_BroadcastToUser_FullBuffer(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	client := &Client{ID: "c1", UserID: "target", Send: make(chan []byte, 1)}
	hub.Register(client)
	time.Sleep(50 * time.Millisecond)

	// Fill buffer
	client.Send <- []byte("filler")

	// BroadcastToUser should not block
	event := Event{Type: "user.skip", Data: "dropped"}
	hub.BroadcastToUser("target", event)

	msg := <-client.Send
	if string(msg) != "filler" {
		t.Errorf("expected filler, got %q", string(msg))
	}

	select {
	case <-client.Send:
		t.Error("should not have received the broadcast when buffer was full")
	case <-time.After(100 * time.Millisecond):
		// expected
	}
}

func TestHub_BroadcastToUser_NoMatchingUser(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	client := &Client{ID: "c1", UserID: "other-user", Send: make(chan []byte, 256)}
	hub.Register(client)
	time.Sleep(50 * time.Millisecond)

	event := Event{Type: "user.event", Data: "hello"}
	hub.BroadcastToUser("nonexistent-user", event)

	select {
	case <-client.Send:
		t.Error("client should not receive message targeted at different user")
	case <-time.After(100 * time.Millisecond):
		// expected
	}
}

func TestHub_MultipleClientsRegisterUnregister(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	clients := make([]*Client, 5)
	for i := 0; i < 5; i++ {
		clients[i] = &Client{
			ID:     "c" + string(rune('0'+i)),
			UserID: "u1",
			Send:   make(chan []byte, 256),
		}
		hub.Register(clients[i])
	}
	time.Sleep(50 * time.Millisecond)

	if count := hub.ClientCount(); count != 5 {
		t.Errorf("ClientCount() = %d, want 5", count)
	}

	// Unregister 3 clients
	for i := 0; i < 3; i++ {
		hub.Unregister(clients[i])
	}
	time.Sleep(50 * time.Millisecond)

	if count := hub.ClientCount(); count != 2 {
		t.Errorf("ClientCount() = %d, want 2", count)
	}
}

func TestHub_Broadcast_EventMarshal(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	client := &Client{ID: "c1", UserID: "u1", Send: make(chan []byte, 256)}
	hub.Register(client)
	time.Sleep(50 * time.Millisecond)

	event := Event{
		Type: "transcode.progress",
		Data: map[string]interface{}{
			"vod_id":   1,
			"progress": 50,
		},
	}
	hub.Broadcast(event)

	select {
	case msg := <-client.Send:
		var received Event
		if err := json.Unmarshal(msg, &received); err != nil {
			t.Fatalf("failed to unmarshal: %v", err)
		}
		if received.Type != "transcode.progress" {
			t.Errorf("type = %q, want %q", received.Type, "transcode.progress")
		}
		data, ok := received.Data.(map[string]interface{})
		if !ok {
			t.Fatal("data should be a map")
		}
		if data["progress"].(float64) != 50 {
			t.Errorf("progress = %v, want 50", data["progress"])
		}
	case <-time.After(time.Second):
		t.Error("did not receive broadcast")
	}
}

func TestEvent_JSONSerialization(t *testing.T) {
	event := Event{Type: "scan.complete", Data: "done"}
	data, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("failed to marshal event: %v", err)
	}

	var decoded Event
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal event: %v", err)
	}
	if decoded.Type != "scan.complete" {
		t.Errorf("type = %q, want %q", decoded.Type, "scan.complete")
	}
}

func TestHub_Broadcast_MarshalError(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	client := &Client{ID: "c1", UserID: "u1", Send: make(chan []byte, 256)}
	hub.Register(client)
	time.Sleep(50 * time.Millisecond)

	// Use a channel as Data which cannot be JSON-marshaled
	event := Event{Type: "bad", Data: make(chan int)}
	hub.Broadcast(event)

	// Client should NOT receive anything since marshal failed
	select {
	case <-client.Send:
		t.Error("client should not receive message when marshal fails")
	case <-time.After(100 * time.Millisecond):
		// expected
	}
}

func TestHub_BroadcastToUser_MarshalError(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	client := &Client{ID: "c1", UserID: "u1", Send: make(chan []byte, 256)}
	hub.Register(client)
	time.Sleep(50 * time.Millisecond)

	event := Event{Type: "bad", Data: make(chan int)}
	hub.BroadcastToUser("u1", event)

	select {
	case <-client.Send:
		t.Error("client should not receive message when marshal fails")
	case <-time.After(100 * time.Millisecond):
		// expected
	}
}

func TestHub_StopClosesClientSendAndDone(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	client := &Client{ID: "c1", UserID: "u1", Send: make(chan []byte, 4)}
	hub.Register(client)
	time.Sleep(50 * time.Millisecond)

	hub.Stop()

	select {
	case <-hub.Done():
	case <-time.After(time.Second):
		t.Fatal("Hub.Done() did not fire within 1s of Stop()")
	}

	// Client.Send must have been closed during Stop() drain so the reader
	// sees EOF instead of blocking forever.
	select {
	case _, ok := <-client.Send:
		if ok {
			// First recv was a leftover message; next must signal closed.
			if _, ok2 := <-client.Send; ok2 {
				t.Fatal("expected Send channel to be closed after Stop()")
			}
		}
	case <-time.After(time.Second):
		t.Fatal("expected Send to be closed after Stop(), got timeout")
	}
}

func TestHub_StopIsIdempotent(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	hub.Stop()
	hub.Stop() // must not panic
	<-hub.Done()
}

func TestHub_RegisterAfterStopDoesNotBlock(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	hub.Stop()
	<-hub.Done()

	done := make(chan struct{})
	go func() {
		client := &Client{ID: "late", UserID: "u", Send: make(chan []byte, 1)}
		hub.Register(client)
		hub.Unregister(client)
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Register/Unregister blocked after Stop()")
	}
}

func TestClient_Fields(t *testing.T) {
	client := &Client{
		ID:     "test-id",
		UserID: "user-123",
		Send:   make(chan []byte, 10),
	}
	if client.ID != "test-id" {
		t.Error("ID should be test-id")
	}
	if client.UserID != "user-123" {
		t.Error("UserID should be user-123")
	}
	if cap(client.Send) != 10 {
		t.Error("Send channel capacity should be 10")
	}
}

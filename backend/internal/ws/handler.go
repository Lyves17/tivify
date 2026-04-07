package ws

import (
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/util"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
)

// UpgradeMiddleware checks that the request is a WebSocket upgrade.
// Must be used before the WebSocket handler.
func UpgradeMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	}
}

// Handler returns a Fiber-compatible WebSocket handler.
// Authenticates via ?token= query parameter (JWT).
func Handler(hub *Hub) fiber.Handler {
	return websocket.New(func(c *websocket.Conn) {
		// Authenticate via token query param
		token := c.Query("token")
		if token == "" {
			c.WriteMessage(websocket.CloseMessage,
				websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "missing token"))
			c.Close()
			return
		}

		claims, err := util.ValidateAccessToken(token)
		if err != nil {
			c.WriteMessage(websocket.CloseMessage,
				websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "invalid token"))
			c.Close()
			return
		}

		client := &Client{
			ID:     uuid.New().String(),
			UserID: claims.UserID.String(),
			Send:   make(chan []byte, 256),
		}

		hub.Register(client)
		defer hub.Unregister(client)

		// Writer goroutine: sends messages and pings
		go func() {
			ticker := time.NewTicker(pingPeriod)
			defer ticker.Stop()

			for {
				select {
				case message, ok := <-client.Send:
					c.SetWriteDeadline(time.Now().Add(writeWait))
					if !ok {
						c.WriteMessage(websocket.CloseMessage, []byte{})
						return
					}
					if err := c.WriteMessage(websocket.TextMessage, message); err != nil {
						return
					}

				case <-ticker.C:
					c.SetWriteDeadline(time.Now().Add(writeWait))
					if err := c.WriteMessage(websocket.PingMessage, nil); err != nil {
						return
					}
				}
			}
		}()

		// Reader loop: keeps connection alive, handles pongs
		c.SetReadDeadline(time.Now().Add(pongWait))
		c.SetPongHandler(func(string) error {
			c.SetReadDeadline(time.Now().Add(pongWait))
			return nil
		})

		for {
			// We don't expect client messages, but must read to handle control frames
			if _, _, err := c.ReadMessage(); err != nil {
				break
			}
		}
	})
}

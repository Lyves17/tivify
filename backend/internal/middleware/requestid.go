package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const RequestIDHeader = "X-Request-ID"
const RequestIDContextKey = "request_id"

// RequestID generates a unique request ID for each request and adds it to context and response headers.
// This enables request tracing throughout the application.
func RequestID() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Check if request already has an ID (from upstream)
		requestID := c.Get(RequestIDHeader)
		if requestID == "" {
			// Generate new UUID
			requestID = uuid.New().String()
		}

		// Store in context for use in handlers/services
		c.Locals(RequestIDContextKey, requestID)

		// Set in response header for client tracing
		c.Set(RequestIDHeader, requestID)

		// Continue to next handler
		return c.Next()
	}
}

// GetRequestID retrieves the request ID from the context
func GetRequestID(c *fiber.Ctx) string {
	id := c.Locals(RequestIDContextKey)
	if id == nil {
		return ""
	}
	// B16: Add ok check to type assertion to safely handle type mismatches
	requestID, ok := id.(string)
	if !ok {
		return ""
	}
	return requestID
}

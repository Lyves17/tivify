package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

// InternalOnly restricts access to localhost/internal requests only.
// Used for endpoints that should only be called from nginx auth_request or internal services.
// Checks if request is from 127.0.0.1, ::1, or localhost
func InternalOnly() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Get the client IP
		clientIP := c.IP()

		// List of allowed internal IPs
		internalIPs := map[string]bool{
			"127.0.0.1": true,
			"localhost": true,
			"::1":       true,
		}

		// Also check X-Forwarded-For header which nginx auth_request may set
		if forwardedFor := c.Get("X-Forwarded-For"); forwardedFor != "" {
			// X-Forwarded-For can be comma-separated list
			ips := strings.Split(forwardedFor, ",")
			if len(ips) > 0 {
				first := strings.TrimSpace(ips[0])
				if internalIPs[first] {
					return c.Next()
				}
			}
		}

		// Check direct client IP
		if internalIPs[clientIP] {
			return c.Next()
		}

		// Reject external requests
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Acceso denegado: este endpoint solo es accesible desde localhost",
		})
	}
}

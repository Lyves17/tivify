package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

// RateLimit creates a rate limiting middleware with custom max requests and window
func RateLimit(max int, window time.Duration) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        max,
		Expiration: window,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"message": "Demasiadas solicitudes, intente de nuevo mas tarde",
			})
		},
	})
}

// RateLimitStrict: 5 requests per minute (for auth endpoints)
func RateLimitStrict() fiber.Handler {
	return RateLimit(5, 1*time.Minute)
}

// RateLimitModerate: 60 requests per minute (for API endpoints)
func RateLimitModerate() fiber.Handler {
	return RateLimit(60, 1*time.Minute)
}

// RateLimitRelaxed: 120 requests per minute (for read operations)
func RateLimitRelaxed() fiber.Handler {
	return RateLimit(120, 1*time.Minute)
}

// B12: RateLimitLibraryScan: 1 request per 30 seconds (for library scan endpoint)
// Prevents resource-intensive scanning from being triggered too frequently
func RateLimitLibraryScan() fiber.Handler {
	return RateLimit(1, 30*time.Second)
}

// B13: RateLimitUpload: 5 uploads per minute (for file upload endpoints)
// Prevents abuse of upload functionality while allowing reasonable usage
func RateLimitUpload() fiber.Handler {
	return RateLimit(5, 1*time.Minute)
}

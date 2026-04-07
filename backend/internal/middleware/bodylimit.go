package middleware

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
)

// BodyLimit sets a custom body size limit for specific routes
// size parameter should be in bytes
func BodyLimit(size int) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Check Content-Length header
		contentLength := c.Request().Header.ContentLength()
		if int64(contentLength) > int64(size) {
			return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
				"success": false,
				"message": fmt.Sprintf("Request body exceeds maximum size of %d bytes", size),
			})
		}
		return c.Next()
	}
}

// BodyLimitLargeFile sets a 2GB limit for large video uploads
func BodyLimitLargeFile() fiber.Handler {
	return BodyLimit(2 * 1024 * 1024 * 1024) // 2GB
}

// BodyLimitMediumFile sets a 500MB limit for medium files
func BodyLimitMediumFile() fiber.Handler {
	return BodyLimit(500 * 1024 * 1024) // 500MB
}

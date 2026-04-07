package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func CORS(allowOrigins string) fiber.Handler {
	if allowOrigins == "" {
		allowOrigins = "http://localhost"
	}

	// B15: Validate origins against whitelist when credentials are allowed
	// Parse origins from config (comma-separated)
	var originList []string
	if allowOrigins != "*" && allowOrigins != "" {
		originList = strings.Split(allowOrigins, ",")
		for i, o := range originList {
			originList[i] = strings.TrimSpace(o)
		}
	}

	// Fiber no permite AllowCredentials con wildcard origin
	allowCreds := allowOrigins != "*"

	return cors.New(cors.Config{
		AllowOrigins:     allowOrigins,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS,PATCH",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-Requested-With",
		AllowCredentials: allowCreds,
		MaxAge:           86400,
		// B15: Custom AllowOriginFunc to validate against whitelist when credentials are enabled
		AllowOriginsFunc: func(origin string) bool {
			// If wildcard is configured, allow all origins (but credentials won't be sent)
			if allowOrigins == "*" {
				return true
			}
			// Check if origin is in whitelist
			for _, o := range originList {
				if o == origin {
					return true
				}
			}
			return false
		},
	})
}

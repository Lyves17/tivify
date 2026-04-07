package middleware

import "github.com/gofiber/fiber/v2"

func AdminRequired() fiber.Handler {
	return func(c *fiber.Ctx) error {
		role, ok := c.Locals("role").(string)
		if !ok || role != "admin" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"message": "Acceso solo para administradores",
			})
		}
		return c.Next()
	}
}

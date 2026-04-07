package handler

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/config"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
)

type AuthHandler struct {
	authService  *service.AuthService
	userService  *service.UserService
	secureCookie bool
}

func NewAuthHandler(authService *service.AuthService, userService *service.UserService, cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		authService:  authService,
		userService:  userService,
		secureCookie: cfg.AppEnv == "production",
	}
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req dto.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	if req.Username == "" || req.Password == "" {
		return util.Error(c, fiber.StatusBadRequest, "Usuario y contrasena son requeridos")
	}

	userAgent := c.Get("User-Agent")
	ipAddress := c.IP()

	response, refreshToken, err := h.authService.Login(req, userAgent, ipAddress)
	if err != nil {
		return util.Error(c, fiber.StatusUnauthorized, err.Error())
	}

	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		HTTPOnly: true,
		Secure:   h.secureCookie,
		SameSite: "Lax",
		Path:     "/api",
		MaxAge:   int(7 * 24 * time.Hour / time.Second),
	})

	return util.Success(c, response)
}

func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	refreshToken := c.Cookies("refresh_token")
	if refreshToken == "" {
		return util.Error(c, fiber.StatusUnauthorized, "Refresh token no encontrado")
	}

	response, newRefreshToken, err := h.authService.RefreshToken(refreshToken)
	if err != nil {
		return util.Error(c, fiber.StatusUnauthorized, err.Error())
	}

	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    newRefreshToken,
		HTTPOnly: true,
		Secure:   h.secureCookie,
		SameSite: "Lax",
		Path:     "/api",
		MaxAge:   int(7 * 24 * time.Hour / time.Second),
	})

	return util.Success(c, response)
}

func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	refreshToken := c.Cookies("refresh_token")
	if refreshToken != "" {
		h.authService.Logout(refreshToken)
	}

	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    "",
		HTTPOnly: true,
		Path:     "/api",
		MaxAge:   -1,
	})

	return util.SuccessMessage(c, "Sesion cerrada")
}

func (h *AuthHandler) Me(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return util.Error(c, fiber.StatusUnauthorized, "No autenticado")
	}

	user, err := h.authService.GetCurrentUser(userID)
	if err != nil {
		return util.Error(c, fiber.StatusNotFound, err.Error())
	}

	return util.Success(c, user)
}

func (h *AuthHandler) UpdateProfile(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return util.Error(c, fiber.StatusUnauthorized, "No autenticado")
	}

	var req dto.UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	if err := h.userService.UpdateProfile(userID, req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return util.SuccessMessage(c, "Perfil actualizado")
}

func (h *AuthHandler) ChangePassword(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return util.Error(c, fiber.StatusUnauthorized, "No autenticado")
	}

	var req dto.ChangePasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	if err := h.userService.ChangePassword(userID, req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return util.SuccessMessage(c, "Contrasena actualizada")
}

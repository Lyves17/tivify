package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
)

type UserHandler struct {
	service *service.UserService
}

func NewUserHandler(service *service.UserService) *UserHandler {
	return &UserHandler{service: service}
}

func (h *UserHandler) List(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))
	page, perPage = util.ClampPagination(page, perPage)

	users, total, err := h.service.List(page, perPage)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error listando usuarios")
	}
	return util.Paginated(c, users, total, page, perPage)
}

func (h *UserHandler) GetByID(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	user, err := h.service.GetByID(id)
	if err != nil {
		return util.Error(c, fiber.StatusNotFound, err.Error())
	}
	return util.Success(c, user)
}

func (h *UserHandler) Create(c *fiber.Ctx) error {
	var req dto.CreateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	user, err := h.service.Create(req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(util.APIResponse{Success: true, Data: user})
}

func (h *UserHandler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	var req dto.UpdateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	user, err := h.service.Update(id, req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return util.Success(c, user)
}

func (h *UserHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	user, err := h.service.GetByID(id)
	if err != nil {
		return util.Error(c, fiber.StatusNotFound, "Usuario no encontrado")
	}
	if user.Role == "admin" {
		return util.Error(c, fiber.StatusForbidden, "No se puede eliminar un administrador")
	}

	if err := h.service.Delete(id); err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error eliminando usuario")
	}
	return util.SuccessMessage(c, "Usuario eliminado")
}

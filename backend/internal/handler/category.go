package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
)

type CategoryHandler struct {
	service *service.CategoryService
}

func NewCategoryHandler(service *service.CategoryService) *CategoryHandler {
	return &CategoryHandler{service: service}
}

func (h *CategoryHandler) List(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))
	page, perPage = util.ClampPagination(page, perPage)

	categories, total, err := h.service.List(page, perPage)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error listando categorias")
	}

	return util.Paginated(c, categories, total, page, perPage)
}

func (h *CategoryHandler) ListByType(c *fiber.Ctx) error {
	categoryType := c.Query("type")
	if categoryType == "" {
		return util.Error(c, fiber.StatusBadRequest, "Tipo es requerido")
	}

	categories, err := h.service.ListByType(categoryType)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error listando categorias")
	}

	return util.Success(c, categories)
}

func (h *CategoryHandler) GetByID(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	category, err := h.service.GetByID(uint(id))
	if err != nil {
		return util.Error(c, fiber.StatusNotFound, err.Error())
	}

	return util.Success(c, category)
}

func (h *CategoryHandler) Create(c *fiber.Ctx) error {
	var req dto.CreateCategoryRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	category, err := h.service.Create(req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return c.Status(fiber.StatusCreated).JSON(util.APIResponse{Success: true, Data: category})
}

func (h *CategoryHandler) Update(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	var req dto.UpdateCategoryRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	category, err := h.service.Update(uint(id), req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return util.Success(c, category)
}

func (h *CategoryHandler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	if err := h.service.Delete(uint(id)); err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error eliminando categoria")
	}

	return util.SuccessMessage(c, "Categoria eliminada")
}

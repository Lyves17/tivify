package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
)

type SeriesHandler struct {
	service *service.SeriesService
}

func NewSeriesHandler(service *service.SeriesService) *SeriesHandler {
	return &SeriesHandler{service: service}
}

func (h *SeriesHandler) List(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))
	page, perPage = util.ClampPagination(page, perPage)

	series, total, err := h.service.List(page, perPage)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error listando series")
	}
	return util.Paginated(c, series, total, page, perPage)
}

func (h *SeriesHandler) ListActive(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))
	page, perPage = util.ClampPagination(page, perPage)
	search := c.Query("search")
	var categoryID *uint
	if catStr := c.Query("category_id"); catStr != "" {
		if id, err := strconv.ParseUint(catStr, 10, 32); err == nil {
			uid := uint(id)
			categoryID = &uid
		}
	}

	series, total, err := h.service.ListActive(page, perPage, search, categoryID)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error listando series")
	}
	return util.Paginated(c, series, total, page, perPage)
}

func (h *SeriesHandler) GetByID(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	series, err := h.service.GetByID(uint(id))
	if err != nil {
		return util.Error(c, fiber.StatusNotFound, err.Error())
	}
	return util.Success(c, series)
}

func (h *SeriesHandler) GetEpisodes(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	episodes, err := h.service.GetEpisodes(uint(id))
	if err != nil {
		return util.Error(c, fiber.StatusNotFound, err.Error())
	}
	return util.Success(c, episodes)
}

func (h *SeriesHandler) Create(c *fiber.Ctx) error {
	var req dto.CreateSeriesRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	series, err := h.service.Create(req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(util.APIResponse{Success: true, Data: series})
}

func (h *SeriesHandler) Update(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	var req dto.UpdateSeriesRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	series, err := h.service.Update(uint(id), req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return util.Success(c, series)
}

func (h *SeriesHandler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	if err := h.service.Delete(uint(id)); err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error eliminando serie")
	}
	return util.SuccessMessage(c, "Serie eliminada")
}

// EnrichWithTMDB enriquece series sin poster con datos de TMDB
func (h *SeriesHandler) EnrichWithTMDB(c *fiber.Ctx) error {
	result, err := h.service.EnrichWithTMDB()
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, err.Error())
	}
	return util.Success(c, result)
}

package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
)

type VODHandler struct {
	service *service.VODService
}

func NewVODHandler(service *service.VODService) *VODHandler {
	return &VODHandler{service: service}
}

func (h *VODHandler) List(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))
	page, perPage = util.ClampPagination(page, perPage)

	vods, total, err := h.service.List(page, perPage)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error listando VODs")
	}
	return util.Paginated(c, vods, total, page, perPage)
}

func (h *VODHandler) ListActive(c *fiber.Ctx) error {
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

	vods, total, err := h.service.ListActive(page, perPage, search, categoryID)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error listando VODs")
	}
	return util.Paginated(c, vods, total, page, perPage)
}

// DebugStats devuelve estadisticas de VODs en la BD para diagnostico
func (h *VODHandler) DebugStats(c *fiber.Ctx) error {
	stats, err := h.service.DebugStats()
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, err.Error())
	}
	return util.Success(c, stats)
}

func (h *VODHandler) GetByID(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	vod, err := h.service.GetByID(uint(id))
	if err != nil {
		return util.Error(c, fiber.StatusNotFound, err.Error())
	}
	return util.Success(c, vod)
}

func (h *VODHandler) Create(c *fiber.Ctx) error {
	var req dto.CreateVODRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	if err := util.ValidateStringLength(req.Title, "titulo", util.MaxNameLength); err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}
	if err := util.ValidateStringLength(req.Description, "descripcion", util.MaxDescriptionLength); err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	vod, err := h.service.Create(req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(util.APIResponse{Success: true, Data: vod})
}

func (h *VODHandler) Update(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	var req dto.UpdateVODRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	if err := util.ValidateStringLength(req.Title, "titulo", util.MaxNameLength); err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}
	if err := util.ValidateStringLength(req.Description, "descripcion", util.MaxDescriptionLength); err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	vod, err := h.service.Update(uint(id), req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return util.Success(c, vod)
}

func (h *VODHandler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	if err := h.service.Delete(uint(id)); err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error eliminando VOD")
	}
	return util.SuccessMessage(c, "VOD eliminado")
}

// EnrichWithTMDB enriquece VODs sin poster con datos de TMDB
func (h *VODHandler) EnrichWithTMDB(c *fiber.Ctx) error {
	result, err := h.service.EnrichWithTMDB()
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, err.Error())
	}
	return util.Success(c, result)
}

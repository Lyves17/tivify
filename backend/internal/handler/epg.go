package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
)

type EPGHandler struct {
	service *service.EPGService
}

func NewEPGHandler(service *service.EPGService) *EPGHandler {
	return &EPGHandler{service: service}
}

func (h *EPGHandler) List(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))
	page, perPage = util.ClampPagination(page, perPage)

	entries, total, err := h.service.List(page, perPage)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error listando EPG")
	}
	return util.Paginated(c, entries, total, page, perPage)
}

func (h *EPGHandler) ListByChannel(c *fiber.Ctx) error {
	channelIDStr := c.Query("channel_id")
	if channelIDStr == "" {
		return util.Error(c, fiber.StatusBadRequest, "channel_id es requerido")
	}
	channelID, err := strconv.ParseUint(channelIDStr, 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "channel_id invalido")
	}

	date := c.Query("date")

	entries, err := h.service.ListByChannel(uint(channelID), date)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error listando EPG")
	}
	return util.Success(c, entries)
}

func (h *EPGHandler) GetByID(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	entry, err := h.service.GetByID(uint(id))
	if err != nil {
		return util.Error(c, fiber.StatusNotFound, err.Error())
	}
	return util.Success(c, entry)
}

func (h *EPGHandler) Create(c *fiber.Ctx) error {
	var req dto.CreateEPGRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	entry, err := h.service.Create(req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(util.APIResponse{Success: true, Data: entry})
}

func (h *EPGHandler) Update(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	var req dto.UpdateEPGRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	entry, err := h.service.Update(uint(id), req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return util.Success(c, entry)
}

func (h *EPGHandler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	if err := h.service.Delete(uint(id)); err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error eliminando entrada EPG")
	}
	return util.SuccessMessage(c, "Entrada EPG eliminada")
}

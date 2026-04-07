package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
)

type EmissionHandler struct {
	service *service.EmissionService
}

func NewEmissionHandler(service *service.EmissionService) *EmissionHandler {
	return &EmissionHandler{service: service}
}

// Start inicia una emisión en vivo para un canal
// POST /api/v1/admin/channels/:id/emission/start
func (h *EmissionHandler) Start(c *fiber.Ctx) error {
	channelID, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID de canal invalido")
	}

	result, err := h.service.Start(uint(channelID))
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return util.Success(c, result)
}

// Stop detiene una emisión en vivo
// POST /api/v1/admin/channels/:id/emission/stop
func (h *EmissionHandler) Stop(c *fiber.Ctx) error {
	channelID, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID de canal invalido")
	}

	if err := h.service.Stop(uint(channelID)); err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return util.SuccessMessage(c, "Emision detenida")
}

// Status obtiene el estado de emisión de un canal
// GET /api/v1/admin/channels/:id/emission/status
func (h *EmissionHandler) Status(c *fiber.Ctx) error {
	channelID, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID de canal invalido")
	}

	result, err := h.service.GetStatus(uint(channelID))
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error obteniendo estado de emision")
	}

	return util.Success(c, result)
}

// LiveChannels retorna los IDs de canales con emisión activa
// GET /api/v1/emissions/live
func (h *EmissionHandler) LiveChannels(c *fiber.Ctx) error {
	ids, err := h.service.GetLiveChannelIDs()
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error obteniendo canales en vivo")
	}

	return util.Success(c, fiber.Map{"live_channel_ids": ids})
}

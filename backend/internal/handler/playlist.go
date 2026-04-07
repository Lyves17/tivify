package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
)

type PlaylistHandler struct {
	service *service.PlaylistService
}

func NewPlaylistHandler(service *service.PlaylistService) *PlaylistHandler {
	return &PlaylistHandler{service: service}
}

func (h *PlaylistHandler) GetByChannel(c *fiber.Ctx) error {
	channelID, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID de canal invalido")
	}

	result, err := h.service.GetByChannelID(uint(channelID))
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error al obtener playlist")
	}

	return util.Success(c, result)
}

func (h *PlaylistHandler) AddItem(c *fiber.Ctx) error {
	channelID, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID de canal invalido")
	}

	var req dto.AddPlaylistItemRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	result, err := h.service.AddItem(uint(channelID), req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": result})
}

func (h *PlaylistHandler) RemoveItem(c *fiber.Ctx) error {
	channelID, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID de canal invalido")
	}

	itemID, err := strconv.ParseUint(c.Params("itemId"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID de item invalido")
	}

	result, err := h.service.RemoveItem(uint(channelID), uint(itemID))
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return util.Success(c, result)
}

func (h *PlaylistHandler) Reorder(c *fiber.Ctx) error {
	channelID, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID de canal invalido")
	}

	var req dto.ReorderPlaylistRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	result, err := h.service.Reorder(uint(channelID), req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return util.Success(c, result)
}

func (h *PlaylistHandler) UpdateMode(c *fiber.Ctx) error {
	channelID, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID de canal invalido")
	}

	var req dto.UpdatePlaylistModeRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	result, err := h.service.UpdateMode(uint(channelID), req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return util.Success(c, result)
}

func (h *PlaylistHandler) GenerateStream(c *fiber.Ctx) error {
	channelID, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID de canal invalido")
	}

	result, err := h.service.GenerateMasterPlaylist(uint(channelID))
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return util.Success(c, result)
}

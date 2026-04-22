package handler

import (
	"errors"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
	"gorm.io/gorm"
)

type ChannelHandler struct {
	service *service.ChannelService
}

func NewChannelHandler(service *service.ChannelService) *ChannelHandler {
	return &ChannelHandler{service: service}
}

func (h *ChannelHandler) List(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))
	page, perPage = util.ClampPagination(page, perPage)

	channels, total, err := h.service.List(page, perPage)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error listando canales")
	}
	return util.Paginated(c, channels, total, page, perPage)
}

func (h *ChannelHandler) ListActive(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))
	page, perPage = util.ClampPagination(page, perPage)
	search := c.Query("search")

	// B10: Validate search parameter length
	if err := util.ValidateStringLength(search, "search", util.MaxSearchLength); err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	var categoryID *uint
	if catStr := c.Query("category_id"); catStr != "" {
		if id, err := strconv.ParseUint(catStr, 10, 32); err == nil {
			uid := uint(id)
			categoryID = &uid
		}
	}

	channels, total, err := h.service.ListActive(page, perPage, search, categoryID)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error listando canales")
	}
	return util.Paginated(c, channels, total, page, perPage)
}

func (h *ChannelHandler) GetByID(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	channel, err := h.service.GetByID(uint(id))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return util.Error(c, fiber.StatusNotFound, "Canal no encontrado")
		}
		return util.Error(c, fiber.StatusInternalServerError, "Error obteniendo canal")
	}
	return util.Success(c, channel)
}

func (h *ChannelHandler) Create(c *fiber.Ctx) error {
	var req dto.CreateChannelRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	if err := util.ValidateStringLength(req.Name, "nombre", util.MaxNameLength); err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}
	if err := util.ValidateURL(req.LogoURL, "logo_url"); err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	channel, err := h.service.Create(req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(util.APIResponse{Success: true, Data: channel})
}

func (h *ChannelHandler) Update(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	var req dto.UpdateChannelRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	if err := util.ValidateStringLength(req.Name, "nombre", util.MaxNameLength); err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}
	if err := util.ValidateURL(req.LogoURL, "logo_url"); err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	channel, err := h.service.Update(uint(id), req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return util.Success(c, channel)
}

func (h *ChannelHandler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	if err := h.service.Delete(uint(id)); err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error eliminando canal")
	}
	return util.SuccessMessage(c, "Canal eliminado")
}

func (h *ChannelHandler) AddStream(c *fiber.Ctx) error {
	channelID, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	var req dto.CreateStreamRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	stream, err := h.service.AddStream(uint(channelID), req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(util.APIResponse{Success: true, Data: stream})
}

func (h *ChannelHandler) UpdateStream(c *fiber.Ctx) error {
	streamID, err := strconv.ParseUint(c.Params("streamId"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	var req dto.UpdateStreamRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	stream, err := h.service.UpdateStream(uint(streamID), req)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return util.Success(c, stream)
}

func (h *ChannelHandler) DeleteStream(c *fiber.Ctx) error {
	streamID, err := strconv.ParseUint(c.Params("streamId"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	if err := h.service.DeleteStream(uint(streamID)); err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error eliminando stream")
	}
	return util.SuccessMessage(c, "Stream eliminado")
}

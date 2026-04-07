package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
)

type WatchHistoryHandler struct {
	service *service.WatchHistoryService
}

func NewWatchHistoryHandler(service *service.WatchHistoryService) *WatchHistoryHandler {
	return &WatchHistoryHandler{service: service}
}

func (h *WatchHistoryHandler) List(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return util.Error(c, fiber.StatusUnauthorized, "No autenticado")
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))
	page, perPage = util.ClampPagination(page, perPage)

	history, total, err := h.service.ListByUser(userID, page, perPage)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error listando historial")
	}
	return util.Paginated(c, history, total, page, perPage)
}

func (h *WatchHistoryHandler) Record(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return util.Error(c, fiber.StatusUnauthorized, "No autenticado")
	}

	var req struct {
		ContentType string `json:"content_type"`
		ContentID   uint   `json:"content_id"`
		Progress    int    `json:"progress"`
		Duration    int    `json:"duration"`
	}
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	if err := h.service.Record(userID, req.ContentType, req.ContentID, req.Progress, req.Duration); err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error registrando historial")
	}
	return util.SuccessMessage(c, "Historial registrado")
}

func (h *WatchHistoryHandler) ContinueWatching(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return util.Error(c, fiber.StatusUnauthorized, "No autenticado")
	}

	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	if limit < 1 {
		limit = 10
	}
	if limit > 20 {
		limit = 20
	}

	items, err := h.service.ContinueWatching(userID, limit)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error obteniendo contenido")
	}
	return util.Success(c, items)
}

func (h *WatchHistoryHandler) Delete(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return util.Error(c, fiber.StatusUnauthorized, "No autenticado")
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	if err := h.service.Delete(uint(id), userID); err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error eliminando historial")
	}
	return util.SuccessMessage(c, "Entrada eliminada")
}

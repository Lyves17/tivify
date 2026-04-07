package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
)

type FavoriteHandler struct {
	service *service.FavoriteService
}

func NewFavoriteHandler(service *service.FavoriteService) *FavoriteHandler {
	return &FavoriteHandler{service: service}
}

func (h *FavoriteHandler) List(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return util.Error(c, fiber.StatusUnauthorized, "No autenticado")
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))
	page, perPage = util.ClampPagination(page, perPage)

	favorites, total, err := h.service.ListByUser(userID, page, perPage)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error listando favoritos")
	}
	return util.Paginated(c, favorites, total, page, perPage)
}

func (h *FavoriteHandler) Toggle(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return util.Error(c, fiber.StatusUnauthorized, "No autenticado")
	}

	var req struct {
		Type string `json:"type"`
		ID   uint   `json:"id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	added, err := h.service.Toggle(userID, req.Type, req.ID)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return util.Success(c, fiber.Map{"added": added})
}

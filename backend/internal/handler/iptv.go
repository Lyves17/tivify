package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
)

// iptvChannelDeleter is the subset of ChannelRepository needed by IPTVHandler.
type iptvChannelDeleter interface {
	DeleteBySource(source string) error
}

type IPTVHandler struct {
	seeder      *service.IPTVSeeder
	channelRepo iptvChannelDeleter
}

func NewIPTVHandler(seeder *service.IPTVSeeder, channelRepo iptvChannelDeleter) *IPTVHandler {
	return &IPTVHandler{seeder: seeder, channelRepo: channelRepo}
}

// Import arranca una importación IPTV con filtros (en goroutine).
// POST /api/v1/admin/iptv/import
func (h *IPTVHandler) Import(c *fiber.Ctx) error {
	if h.seeder.IsRunning() {
		return util.Error(c, fiber.StatusConflict, "Ya hay una importacion en curso")
	}

	var req dto.IPTVImportRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Request inválido")
	}

	opts := service.IPTVImportOptions{
		M3UURL:     req.M3UURL,
		EPGURL:     req.EPGURL,
		Countries:  req.Countries,
		Languages:  req.Languages,
		Categories: req.Categories,
		Replace:    req.Replace,
		Source:     req.Source,
	}

	// Lanzar importación en background para no bloquear la respuesta HTTP
	go h.seeder.ImportWithOptions(opts)

	return util.Success(c, fiber.Map{
		"message": "Importacion iniciada",
		"options": fiber.Map{
			"m3u_url":    opts.M3UURL,
			"countries":  opts.Countries,
			"languages":  opts.Languages,
			"categories": opts.Categories,
			"replace":    opts.Replace,
			"source":     opts.Source,
		},
	})
}

// Status devuelve el progreso de la importación actual.
// GET /api/v1/admin/iptv/status
func (h *IPTVHandler) Status(c *fiber.Ctx) error {
	st := h.seeder.GetStatus()
	resp := dto.IPTVStatusResponse{
		Running:  st.Running,
		Total:    st.Total,
		Current:  st.Current,
		Percent:  st.Percent,
		Message:  st.Message,
		Error:    st.Error,
		Imported: st.Imported,
	}
	return util.Success(c, resp)
}

// DeleteBySource elimina todos los canales de una fuente IPTV.
// Los canales manuales (source="") nunca se tocan.
// DELETE /api/v1/admin/iptv/channels?source=iptv-org
func (h *IPTVHandler) DeleteBySource(c *fiber.Ctx) error {
	source := c.Query("source", "iptv-org")
	if source == "" {
		return util.Error(c, fiber.StatusBadRequest, "El parámetro 'source' es requerido")
	}

	if err := h.channelRepo.DeleteBySource(source); err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error eliminando canales")
	}

	return util.Success(c, dto.IPTVDeleteResponse{
		Source:  source,
		Message: "Canales eliminados correctamente",
	})
}

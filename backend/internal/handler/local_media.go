package handler

import (
	"log"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
)

type LocalMediaHandler struct {
	service    *service.LocalMediaService
	vodService *service.VODService
}

func NewLocalMediaHandler(svc *service.LocalMediaService, vodSvc *service.VODService) *LocalMediaHandler {
	return &LocalMediaHandler{service: svc, vodService: vodSvc}
}

func (h *LocalMediaHandler) Upload(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		log.Printf("[UPLOAD] Error recibiendo archivo: %v", err)
		return util.Error(c, fiber.StatusBadRequest, "Archivo no proporcionado")
	}

	log.Printf("[UPLOAD] Recibido: %s (%d bytes)", file.Filename, file.Size)

	result, err := h.service.Upload(file)
	if err != nil {
		log.Printf("[UPLOAD] Error procesando %s: %v", file.Filename, err)
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	log.Printf("[UPLOAD] OK: media_id=%d file=%s", result.ID, file.Filename)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": result})
}

func (h *LocalMediaHandler) List(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))
	page, perPage = util.ClampPagination(page, perPage)

	data, total, err := h.service.List(page, perPage)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error al listar media")
	}

	return util.Paginated(c, data, total, page, perPage)
}

func (h *LocalMediaHandler) GetByID(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	result, err := h.service.GetByID(uint(id))
	if err != nil {
		return util.Error(c, fiber.StatusNotFound, "Media no encontrada")
	}

	return util.Success(c, result)
}

func (h *LocalMediaHandler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	if err := h.service.Delete(uint(id)); err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error al eliminar media")
	}

	return util.Success(c, nil)
}

// UploadAndCreateVOD sube un archivo (sin transcodificar) y crea un VOD directo.
// POST /api/v1/admin/media/upload-vod
func (h *LocalMediaHandler) UploadAndCreateVOD(c *fiber.Ctx) error {
	log.Printf("[UPLOAD-VOD] === REQUEST === content-length=%s content-type=%s",
		c.Get("Content-Length"), c.Get("Content-Type"))

	file, err := c.FormFile("file")
	if err != nil {
		log.Printf("[UPLOAD-VOD] ERROR FormFile: %v", err)
		return util.Error(c, fiber.StatusBadRequest, "Archivo no proporcionado: "+err.Error())
	}

	title := c.FormValue("title")
	if title == "" {
		name := file.Filename
		ext := filepath.Ext(name)
		title = name[:len(name)-len(ext)]
		title = strings.NewReplacer("_", " ", ".", " ", "-", " ").Replace(title)
		title = strings.TrimSpace(title)
	}

	// Parse optional series fields from form data
	var seriesID *uint
	if sid := c.FormValue("series_id"); sid != "" {
		if parsed, err := strconv.ParseUint(sid, 10, 32); err == nil {
			uid := uint(parsed)
			seriesID = &uid
		}
	}
	seasonNumber := 0
	if sn := c.FormValue("season_number"); sn != "" {
		if parsed, err := strconv.Atoi(sn); err == nil {
			seasonNumber = parsed
		}
	}
	episodeNumber := 0
	if en := c.FormValue("episode_number"); en != "" {
		if parsed, err := strconv.Atoi(en); err == nil {
			episodeNumber = parsed
		}
	}

	log.Printf("[UPLOAD-VOD] Archivo: %s (%d bytes) title=%q series_id=%v season=%d episode=%d",
		file.Filename, file.Size, title, seriesID, seasonNumber, episodeNumber)

	vod, err := h.service.UploadDirect(file, title, seriesID, seasonNumber, episodeNumber)
	if err != nil {
		log.Printf("[UPLOAD-VOD] FAIL: %v", err)
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	log.Printf("[UPLOAD-VOD] OK: vod_id=%d title=%q hls=%s", vod.ID, vod.Title, vod.HLSPath)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": vod})
}

// Diagnostics devuelve información de diagnóstico del pipeline de upload
func (h *LocalMediaHandler) Diagnostics(c *fiber.Ctx) error {
	diag, err := h.service.Diagnostics()
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, err.Error())
	}
	return util.Success(c, diag)
}

// CreateVOD crea un VOD a partir de un LocalMedia ya transcodeado.
// POST /api/v1/admin/media/:id/create-vod
func (h *LocalMediaHandler) CreateVOD(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	media, err := h.service.GetByID(uint(id))
	if err != nil {
		return util.Error(c, fiber.StatusNotFound, "Media no encontrada")
	}

	var req dto.CreateVODFromMediaRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Request invalido")
	}

	log.Printf("[CREATE-VOD] media_id=%d status=%s hls=%s title=%s", id, media.Status, media.HLSPath, req.Title)

	vod, err := h.vodService.CreateFromMedia(media, req)
	if err != nil {
		log.Printf("[CREATE-VOD] Error para media_id=%d: %v", id, err)
		return util.Error(c, fiber.StatusBadRequest, err.Error())
	}

	log.Printf("[CREATE-VOD] OK: vod_id=%d media_id=%d", vod.ID, id)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": vod})
}

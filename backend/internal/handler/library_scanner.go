package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/service"
	"github.com/tivify/backend/internal/util"
)

type LibraryScannerHandler struct {
	service *service.LibraryScannerService
}

func NewLibraryScannerHandler(service *service.LibraryScannerService) *LibraryScannerHandler {
	return &LibraryScannerHandler{service: service}
}

// ListDevices returns available storage devices
func (h *LibraryScannerHandler) ListDevices(c *fiber.Ctx) error {
	devices, err := h.service.ListStorageDevices()
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, err.Error())
	}
	return util.Success(c, devices)
}

// Scan starts a library scan
func (h *LibraryScannerHandler) Scan(c *fiber.Ctx) error {
	var req dto.ScanRequest
	if err := c.BodyParser(&req); err != nil {
		// No body provided, scan default path
		req.Paths = []string{}
	}

	sessionID, err := h.service.ScanLibrary(req.Paths)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data": dto.ScanLibraryResponse{
			SessionID: sessionID,
			Status:    "scanning",
		},
	})
}

// GetScanStatus returns the status of a scan
func (h *LibraryScannerHandler) GetScanStatus(c *fiber.Ctx) error {
	sessionID := c.Params("sessionId")
	status := h.service.GetScanStatus(sessionID)
	if status == nil {
		return util.Error(c, fiber.StatusNotFound, "Sesion de escaneo no encontrada")
	}
	return util.Success(c, dto.ScanStatusResponse{
		SessionID:  status.SessionID,
		Status:     status.Status,
		TotalFiles: status.TotalFiles,
		Scanned:    status.Scanned,
		Error:      status.Error,
	})
}

// GetResults returns paginated scan results
func (h *LibraryScannerHandler) GetResults(c *fiber.Ctx) error {
	sessionID := c.Params("sessionId")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "50"))
	page, perPage = util.ClampPagination(page, perPage)

	items, total, err := h.service.GetScanResults(sessionID, page, perPage)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error obteniendo resultados")
	}

	responses := make([]dto.LibraryScanItemResponse, len(items))
	for i, item := range items {
		responses[i] = toScanItemResponse(item)
	}

	return util.Paginated(c, responses, total, page, perPage)
}

// UpdateItem updates a scan item's metadata
func (h *LibraryScannerHandler) UpdateItem(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return util.Error(c, fiber.StatusBadRequest, "ID invalido")
	}

	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	item, err := h.service.UpdateScanItem(uint(id), body)
	if err != nil {
		return util.Error(c, fiber.StatusNotFound, err.Error())
	}

	return util.Success(c, toScanItemResponse(*item))
}

// Import imports selected scan items as VODs/Series
func (h *LibraryScannerHandler) Import(c *fiber.Ctx) error {
	var req dto.ImportRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	if len(req.ItemIDs) == 0 {
		return util.Error(c, fiber.StatusBadRequest, "No se seleccionaron items")
	}

	imported, failed, err := h.service.ImportItems(req.SessionID, req.ItemIDs)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	return util.Success(c, dto.ImportResponse{
		Imported: imported,
		Failed:   failed,
	})
}

// SearchTMDB performs a manual TMDB search
func (h *LibraryScannerHandler) SearchTMDB(c *fiber.Ctx) error {
	var req dto.TMDBSearchRequest
	if err := c.BodyParser(&req); err != nil {
		return util.Error(c, fiber.StatusBadRequest, "Datos invalidos")
	}

	if req.Query == "" {
		return util.Error(c, fiber.StatusBadRequest, "Query es requerido")
	}

	results, err := h.service.SearchTMDB(req.Query, req.Year, req.MediaType)
	if err != nil {
		return util.Error(c, fiber.StatusInternalServerError, err.Error())
	}

	var responses []dto.TMDBSearchResponse
	for _, r := range results {
		title := r.Title
		if title == "" {
			title = r.Name
		}

		var year int
		dateStr := r.ReleaseDate
		if dateStr == "" {
			dateStr = r.FirstAirDate
		}
		if len(dateStr) >= 4 {
			year, _ = strconv.Atoi(dateStr[:4])
		}

		posterURL := ""
		if r.PosterPath != "" {
			posterURL = "https://image.tmdb.org/t/p/w500" + r.PosterPath
		}
		backdropURL := ""
		if r.BackdropPath != "" {
			backdropURL = "https://image.tmdb.org/t/p/w1280" + r.BackdropPath
		}

		responses = append(responses, dto.TMDBSearchResponse{
			ID:          r.ID,
			Title:       title,
			Overview:    r.Overview,
			PosterURL:   posterURL,
			BackdropURL: backdropURL,
			Year:        year,
			Rating:      r.VoteAverage,
		})
	}

	return util.Success(c, responses)
}

// TMDBStatus checks if the TMDB API is configured and working
func (h *LibraryScannerHandler) TMDBStatus(c *fiber.Ctx) error {
	configured := h.service.IsTMDBConfigured()
	if !configured {
		return util.Success(c, fiber.Map{
			"configured": false,
			"valid":      false,
			"message":    "TMDB API key no configurada. Establece TMDB_API_KEY en el archivo .env",
		})
	}

	err := h.service.ValidateTMDB()
	if err != nil {
		return util.Success(c, fiber.Map{
			"configured": true,
			"valid":      false,
			"message":    err.Error(),
		})
	}

	return util.Success(c, fiber.Map{
		"configured": true,
		"valid":      true,
		"message":    "TMDB API funcionando correctamente",
	})
}

func toScanItemResponse(item model.LibraryScanItem) dto.LibraryScanItemResponse {
	return dto.LibraryScanItemResponse{
		ID:               item.ID,
		ScanSessionID:    item.ScanSessionID,
		FileName:         item.FileName,
		FileSize:         item.FileSize,
		ParsedTitle:      item.ParsedTitle,
		ParsedYear:       item.ParsedYear,
		MediaType:        item.MediaType,
		SeasonNumber:     item.SeasonNumber,
		EpisodeNumber:    item.EpisodeNumber,
		Duration:         item.Duration,
		Resolution:       item.Resolution,
		VideoCodec:       item.VideoCodec,
		AudioCodec:       item.AudioCodec,
		Container:        item.Container,
		NeedsTranscode:   item.NeedsTranscode,
		DirectPlayPath:   item.DirectPlayPath,
		TMDBId:           item.TMDBId,
		TMDBTitle:        item.TMDBTitle,
		TMDBYear:         item.TMDBYear,
		TMDBPosterURL:    item.TMDBPosterURL,
		TMDBBackdropURL:  item.TMDBBackdropURL,
		TMDBDescription:  item.TMDBDescription,
		TMDBRating:       item.TMDBRating,
		TMDBSeriesName:   item.TMDBSeriesName,
		ImportStatus:     item.ImportStatus,
		ImportedVODID:    item.ImportedVODID,
		ImportedSeriesID: item.ImportedSeriesID,
		ErrorMessage:     item.ErrorMessage,
		CreatedAt:        item.CreatedAt,
	}
}

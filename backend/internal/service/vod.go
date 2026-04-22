package service

import (
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
)

type VODService struct {
	repo VODRepositoryInterface
	tmdb *TMDBService
}

func NewVODService(repo VODRepositoryInterface, tmdb *TMDBService) *VODService {
	return &VODService{repo: repo, tmdb: tmdb}
}

func (s *VODService) List(page, perPage int) ([]dto.VODResponse, int64, error) {
	vods, total, err := s.repo.List(page, perPage)
	if err != nil {
		return nil, 0, err
	}
	var result []dto.VODResponse
	for _, v := range vods {
		result = append(result, toVODResponse(v))
	}
	return result, total, nil
}

func (s *VODService) ListActive(page, perPage int, search string, categoryID *uint) ([]dto.VODResponse, int64, error) {
	vods, total, err := s.repo.ListActive(page, perPage, search, categoryID)
	if err != nil {
		return nil, 0, err
	}
	var result []dto.VODResponse
	for _, v := range vods {
		result = append(result, toVODResponse(v))
	}
	return result, total, nil
}

func (s *VODService) GetByID(id uint) (*dto.VODResponse, error) {
	vod, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("VOD no encontrado")
	}
	resp := toVODResponse(*vod)
	return &resp, nil
}

func (s *VODService) Create(req dto.CreateVODRequest) (*dto.VODResponse, error) {
	if req.Title == "" {
		return nil, errors.New("titulo es requerido")
	}

	baseSlug := req.Slug
	if baseSlug == "" {
		baseSlug = generateSlug(req.Title)
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	// Si se proporciona un HLS path manualmente, el VOD ya es reproducible
	transcodeStatus := "pending"
	transcodeProgress := 0
	if req.HLSPath != "" {
		transcodeStatus = "completed"
		transcodeProgress = 100
	}

	// Retry loop: if slug collides in DB, append unique suffix and retry
	var lastErr error
	for attempt := 0; attempt < 5; attempt++ {
		slug := baseSlug
		if attempt > 0 {
			// Use full nanosecond timestamp for uniqueness
			slug = fmt.Sprintf("%s-%d", baseSlug, time.Now().UnixNano())
			log.Printf("[VOD-CREATE] Slug colision intento %d, probando: %s", attempt, slug)
			time.Sleep(time.Millisecond) // ensure different nanos on next attempt
		}

		vod := &model.VOD{
			Title:             req.Title,
			Slug:              slug,
			Description:       req.Description,
			CategoryID:        req.CategoryID,
			Duration:          req.Duration,
			PosterURL:         req.PosterURL,
			BackdropURL:       req.BackdropURL,
			HLSPath:           req.HLSPath,
			TranscodeStatus:   transcodeStatus,
			TranscodeProgress: transcodeProgress,
			Year:              req.Year,
			Rating:            req.Rating,
			IsActive:          isActive,
			SeriesID:          req.SeriesID,
			SeasonNumber:      req.SeasonNumber,
			EpisodeNumber:     req.EpisodeNumber,
		}

		if err := s.repo.Create(vod); err != nil {
			if strings.Contains(err.Error(), "idx_vods_slug") || strings.Contains(err.Error(), "23505") {
				lastErr = err
				log.Printf("[VOD-CREATE] Slug duplicado slug=%s intento=%d, reintentando...", slug, attempt)
				continue
			}
			// Different error — don't retry
			log.Printf("[VOD-CREATE] Error creando VOD title=%s slug=%s: %v", req.Title, slug, err)
			return nil, fmt.Errorf("error creando VOD en BD: %v", err)
		}

		log.Printf("[VOD-CREATE] OK id=%d title=%s slug=%s hls=%s (intento=%d)", vod.ID, req.Title, slug, req.HLSPath, attempt)
		return s.GetByID(vod.ID)
	}

	log.Printf("[VOD-CREATE] FAIL todos los intentos agotados title=%s: %v", req.Title, lastErr)
	return nil, fmt.Errorf("error creando VOD en BD: %v", lastErr)
}

func (s *VODService) Update(id uint, req dto.UpdateVODRequest) (*dto.VODResponse, error) {
	vod, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("VOD no encontrado")
	}

	if req.Title != "" {
		vod.Title = req.Title
	}
	if req.Slug != "" {
		vod.Slug = req.Slug
	}
	if req.Description != "" {
		vod.Description = req.Description
	}
	vod.CategoryID = req.CategoryID
	if req.Duration != nil {
		vod.Duration = *req.Duration
	}
	if req.PosterURL != "" {
		vod.PosterURL = req.PosterURL
	}
	if req.BackdropURL != "" {
		vod.BackdropURL = req.BackdropURL
	}
	if req.HLSPath != "" {
		vod.HLSPath = req.HLSPath
		// Si se actualiza el HLS path y el estado aún era pending, marcarlo como completado
		if vod.TranscodeStatus == "pending" || vod.TranscodeStatus == "" {
			vod.TranscodeStatus = "completed"
			vod.TranscodeProgress = 100
		}
	}
	if req.Year != nil {
		vod.Year = *req.Year
	}
	if req.Rating != nil {
		vod.Rating = *req.Rating
	}
	if req.IsActive != nil {
		vod.IsActive = *req.IsActive
	}
	vod.SeriesID = req.SeriesID
	if req.SeasonNumber != nil {
		vod.SeasonNumber = *req.SeasonNumber
	}
	if req.EpisodeNumber != nil {
		vod.EpisodeNumber = *req.EpisodeNumber
	}

	if err := s.repo.Update(vod); err != nil {
		return nil, errors.New("error actualizando VOD")
	}

	return s.GetByID(vod.ID)
}

func (s *VODService) CreateFromMedia(media *dto.LocalMediaResponse, req dto.CreateVODFromMediaRequest) (*dto.VODResponse, error) {
	if req.Title == "" {
		return nil, errors.New("titulo es requerido")
	}
	if media.Status != "completed" {
		return nil, errors.New("el archivo todavia se esta procesando, espere a que termine")
	}
	if media.HLSPath == "" {
		return nil, errors.New("el archivo no tiene ruta HLS generada")
	}

	slug := req.Slug
	if slug == "" {
		slug = generateSlug(req.Title)
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	// Si no se especifica poster, usar el thumbnail generado automaticamente
	posterURL := req.PosterURL
	if posterURL == "" && media.ThumbnailPath != "" {
		posterURL = media.ThumbnailPath
	}
	// Si no se especifica backdrop, usar el mismo thumbnail como fallback
	backdropURL := req.BackdropURL
	if backdropURL == "" && media.ThumbnailPath != "" {
		backdropURL = media.ThumbnailPath
	}

	vod := &model.VOD{
		Title:             req.Title,
		Slug:              slug,
		Description:       req.Description,
		CategoryID:        req.CategoryID,
		Duration:          int(media.Duration),
		PosterURL:         posterURL,
		BackdropURL:       backdropURL,
		OriginalFilename:  media.OriginalFilename,
		HLSPath:           media.HLSPath,
		TranscodeStatus:   "completed",
		TranscodeProgress: 100,
		FileSize:          media.FileSize,
		Resolution:        media.Resolution,
		Year:              req.Year,
		Rating:            req.Rating,
		IsActive:          isActive,
		SeriesID:          req.SeriesID,
		SeasonNumber:      req.SeasonNumber,
		EpisodeNumber:     req.EpisodeNumber,
	}

	if err := s.repo.Create(vod); err != nil {
		return nil, errors.New("error creando VOD")
	}

	return s.GetByID(vod.ID)
}

func (s *VODService) UpdateFileInfo(id uint, originalFilename, resolution string, fileSize int64) {
	vod, err := s.repo.FindByID(id)
	if err != nil {
		return
	}
	vod.OriginalFilename = originalFilename
	vod.Resolution = resolution
	vod.FileSize = fileSize
	s.repo.Update(vod)
}

// UpdateTranscodeStatus updates the transcode status and progress of a VOD
func (s *VODService) UpdateTranscodeStatus(id uint, status string, progress int, hlsPath string) {
	vod, err := s.repo.FindByID(id)
	if err != nil {
		return
	}
	vod.TranscodeStatus = status
	vod.TranscodeProgress = progress
	if hlsPath != "" {
		vod.HLSPath = hlsPath
	}
	s.repo.Update(vod)
}

func (s *VODService) Delete(id uint) error {
	return s.repo.Delete(id)
}

type VODDebugStats struct {
	Total            int64        `json:"total"`
	ActiveStandalone int64        `json:"active_standalone"`
	ActiveEpisodes   int64        `json:"active_episodes"`
	Inactive         int64        `json:"inactive"`
	VisibleToUsers   int64        `json:"visible_to_users"`
	Problems         []VODProblem `json:"problems"`
}

type VODProblem struct {
	ID              uint   `json:"id"`
	Title           string `json:"title"`
	IsActive        bool   `json:"is_active"`
	SeriesID        *uint  `json:"series_id"`
	TranscodeStatus string `json:"transcode_status"`
	HLSPath         string `json:"hls_path"`
	Reason          string `json:"reason"`
}

func (s *VODService) DebugStats() (*VODDebugStats, error) {
	all, err := s.repo.DebugAll()
	if err != nil {
		return nil, errors.New("error consultando VODs")
	}

	stats := &VODDebugStats{Total: int64(len(all))}
	for _, v := range all {
		if v.IsActive && v.SeriesID == nil {
			stats.ActiveStandalone++
		} else if v.IsActive && v.SeriesID != nil {
			stats.ActiveEpisodes++
		} else if !v.IsActive {
			stats.Inactive++
		}

		// Determinar si hay algún problema que impida que este VOD sea visible
		var reason string
		if !v.IsActive {
			reason = "is_active=false"
		} else if v.SeriesID != nil {
			reason = fmt.Sprintf("es episodio (series_id=%d) — visible solo en su serie", *v.SeriesID)
		} else if v.HLSPath == "" {
			reason = "sin hls_path — no reproducible (subir archivo)"
		} else if v.TranscodeStatus != "completed" {
			reason = fmt.Sprintf("transcode_status=%s — aún no listo", v.TranscodeStatus)
		}

		if reason != "" {
			stats.Problems = append(stats.Problems, VODProblem{
				ID:              v.ID,
				Title:           v.Title,
				IsActive:        v.IsActive,
				SeriesID:        v.SeriesID,
				TranscodeStatus: v.TranscodeStatus,
				HLSPath:         v.HLSPath,
				Reason:          reason,
			})
		}
	}
	stats.VisibleToUsers = stats.ActiveStandalone
	return stats, nil
}

func (s *VODService) CountActive() (int64, error) {
	return s.repo.CountActive()
}

func toVODResponse(v model.VOD) dto.VODResponse {
	resp := dto.VODResponse{
		ID:                v.ID,
		Title:             v.Title,
		Slug:              v.Slug,
		Description:       v.Description,
		CategoryID:        v.CategoryID,
		Duration:          v.Duration,
		PosterURL:         v.PosterURL,
		BackdropURL:       v.BackdropURL,
		HLSPath:           v.HLSPath,
		TranscodeStatus:   v.TranscodeStatus,
		TranscodeProgress: v.TranscodeProgress,
		FileSize:          v.FileSize,
		Resolution:        v.Resolution,
		Year:              v.Year,
		Rating:            v.Rating,
		IsActive:          v.IsActive,
		SeriesID:          v.SeriesID,
		SeasonNumber:      v.SeasonNumber,
		EpisodeNumber:     v.EpisodeNumber,
		CreatedAt:         v.CreatedAt,
	}
	if v.Category != nil {
		cat := toCategoryResponse(*v.Category)
		resp.Category = &cat
	}
	return resp
}

type EnrichResult struct {
	Enriched int `json:"enriched"`
	Failed   int `json:"failed"`
	Skipped  int `json:"skipped"`
}

func (s *VODService) EnrichWithTMDB() (*EnrichResult, error) {
	if s.tmdb == nil || !s.tmdb.IsConfigured() {
		return nil, errors.New("TMDB API key no configurada")
	}

	vods, err := s.repo.ListWithoutPoster()
	if err != nil {
		return nil, fmt.Errorf("error obteniendo VODs: %w", err)
	}

	result := &EnrichResult{}
	for _, v := range vods {
		tmdbResult, err := s.tmdb.SearchMovie(v.Title, v.Year)
		if err != nil {
			log.Printf("TMDB search error for VOD %d (%s): %v", v.ID, v.Title, err)
			result.Failed++
			continue
		}
		if tmdbResult == nil {
			result.Skipped++
			continue
		}

		updated := false
		if v.PosterURL == "" && tmdbResult.PosterPath != "" {
			v.PosterURL = s.tmdb.PosterURL(tmdbResult.PosterPath)
			updated = true
		}
		if v.BackdropURL == "" && tmdbResult.BackdropPath != "" {
			v.BackdropURL = s.tmdb.BackdropURL(tmdbResult.BackdropPath)
			updated = true
		}
		if v.Description == "" && tmdbResult.Overview != "" {
			v.Description = tmdbResult.Overview
			updated = true
		}
		if v.Rating == 0 && tmdbResult.VoteAverage > 0 {
			v.Rating = tmdbResult.VoteAverage
			updated = true
		}
		if v.Year == 0 {
			y := s.tmdb.GetYear(tmdbResult)
			if y > 0 {
				v.Year = y
				updated = true
			}
		}

		if updated {
			if err := s.repo.Update(&v); err != nil {
				log.Printf("Error updating VOD %d: %v", v.ID, err)
				result.Failed++
			} else {
				result.Enriched++
			}
		} else {
			result.Skipped++
		}
	}

	return result, nil
}

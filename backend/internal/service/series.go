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

type SeriesService struct {
	seriesRepo SeriesRepositoryInterface
	vodRepo    VODRepositoryInterface
	tmdb       *TMDBService
}

func NewSeriesService(seriesRepo SeriesRepositoryInterface, vodRepo VODRepositoryInterface, tmdb *TMDBService) *SeriesService {
	return &SeriesService{
		seriesRepo: seriesRepo,
		vodRepo:    vodRepo,
		tmdb:       tmdb,
	}
}

func (s *SeriesService) List(page, perPage int) ([]dto.SeriesResponse, int64, error) {
	series, total, err := s.seriesRepo.List(page, perPage)
	if err != nil {
		return nil, 0, err
	}
	var result []dto.SeriesResponse
	for _, sr := range series {
		count, _ := s.seriesRepo.CountEpisodes(sr.ID)
		result = append(result, toSeriesResponse(sr, int(count)))
	}
	return result, total, nil
}

func (s *SeriesService) ListActive(page, perPage int, search string, categoryID *uint) ([]dto.SeriesResponse, int64, error) {
	series, total, err := s.seriesRepo.ListActive(page, perPage, search, categoryID)
	if err != nil {
		return nil, 0, err
	}
	var result []dto.SeriesResponse
	for _, sr := range series {
		count, _ := s.seriesRepo.CountEpisodes(sr.ID)
		result = append(result, toSeriesResponse(sr, int(count)))
	}
	return result, total, nil
}

func (s *SeriesService) GetByID(id uint) (*dto.SeriesResponse, error) {
	series, err := s.seriesRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("serie no encontrada")
	}
	count, _ := s.seriesRepo.CountEpisodes(id)
	resp := toSeriesResponse(*series, int(count))
	return &resp, nil
}

func (s *SeriesService) GetEpisodes(seriesID uint) ([]dto.VODResponse, error) {
	if _, err := s.seriesRepo.FindByID(seriesID); err != nil {
		return nil, errors.New("serie no encontrada")
	}
	vods, err := s.vodRepo.ListBySeries(seriesID)
	if err != nil {
		return nil, err
	}
	var result []dto.VODResponse
	for _, v := range vods {
		result = append(result, toVODResponse(v))
	}
	return result, nil
}

func (s *SeriesService) Create(req dto.CreateSeriesRequest) (*dto.SeriesResponse, error) {
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

	var lastErr error
	for attempt := 0; attempt < 5; attempt++ {
		slug := baseSlug
		if attempt > 0 {
			slug = fmt.Sprintf("%s-%d", baseSlug, time.Now().UnixNano())
			time.Sleep(time.Millisecond)
		}

		series := &model.Series{
			Title:        req.Title,
			Slug:         slug,
			Description:  req.Description,
			CategoryID:   req.CategoryID,
			PosterURL:    req.PosterURL,
			BackdropURL:  req.BackdropURL,
			Year:         req.Year,
			Rating:       req.Rating,
			TotalSeasons: req.TotalSeasons,
			IsActive:     isActive,
		}

		if err := s.seriesRepo.Create(series); err != nil {
			if strings.Contains(err.Error(), "idx_series_slug") || strings.Contains(err.Error(), "23505") {
				lastErr = err
				log.Printf("[SERIES-CREATE] Slug duplicado slug=%s intento=%d", slug, attempt)
				continue
			}
			return nil, fmt.Errorf("error creando serie: %v", err)
		}

		return s.GetByID(series.ID)
	}

	return nil, fmt.Errorf("error creando serie: %v", lastErr)
}

func (s *SeriesService) Update(id uint, req dto.UpdateSeriesRequest) (*dto.SeriesResponse, error) {
	series, err := s.seriesRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("serie no encontrada")
	}

	if req.Title != "" {
		series.Title = req.Title
	}
	if req.Slug != "" {
		series.Slug = req.Slug
	}
	if req.Description != "" {
		series.Description = req.Description
	}
	series.CategoryID = req.CategoryID
	if req.PosterURL != "" {
		series.PosterURL = req.PosterURL
	}
	if req.BackdropURL != "" {
		series.BackdropURL = req.BackdropURL
	}
	if req.Year != nil {
		series.Year = *req.Year
	}
	if req.Rating != nil {
		series.Rating = *req.Rating
	}
	if req.TotalSeasons != nil {
		series.TotalSeasons = *req.TotalSeasons
	}
	if req.IsActive != nil {
		series.IsActive = *req.IsActive
	}

	if err := s.seriesRepo.Update(series); err != nil {
		return nil, errors.New("error actualizando serie")
	}

	return s.GetByID(series.ID)
}

func (s *SeriesService) Delete(id uint) error {
	return s.seriesRepo.Delete(id)
}

func (s *SeriesService) CountActive() (int64, error) {
	return s.seriesRepo.CountActive()
}

func (s *SeriesService) EnrichWithTMDB() (*EnrichResult, error) {
	if s.tmdb == nil || !s.tmdb.IsConfigured() {
		return nil, errors.New("TMDB API key no configurada")
	}

	seriesList, err := s.seriesRepo.ListWithoutPoster()
	if err != nil {
		return nil, fmt.Errorf("error obteniendo series: %w", err)
	}

	result := &EnrichResult{}
	for _, sr := range seriesList {
		tmdbResult, err := s.tmdb.SearchTV(sr.Title, sr.Year)
		if err != nil {
			log.Printf("TMDB search error for Series %d (%s): %v", sr.ID, sr.Title, err)
			result.Failed++
			continue
		}
		if tmdbResult == nil {
			result.Skipped++
			continue
		}

		updated := false
		if sr.PosterURL == "" && tmdbResult.PosterPath != "" {
			sr.PosterURL = s.tmdb.PosterURL(tmdbResult.PosterPath)
			updated = true
		}
		if sr.BackdropURL == "" && tmdbResult.BackdropPath != "" {
			sr.BackdropURL = s.tmdb.BackdropURL(tmdbResult.BackdropPath)
			updated = true
		}
		if sr.Description == "" && tmdbResult.Overview != "" {
			sr.Description = tmdbResult.Overview
			updated = true
		}
		if sr.Rating == 0 && tmdbResult.VoteAverage > 0 {
			sr.Rating = tmdbResult.VoteAverage
			updated = true
		}
		if sr.Year == 0 {
			y := s.tmdb.GetYear(tmdbResult)
			if y > 0 {
				sr.Year = y
				updated = true
			}
		}

		if updated {
			if err := s.seriesRepo.Update(&sr); err != nil {
				log.Printf("Error updating Series %d: %v", sr.ID, err)
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

func toSeriesResponse(sr model.Series, episodesCount int) dto.SeriesResponse {
	resp := dto.SeriesResponse{
		ID:            sr.ID,
		Title:         sr.Title,
		Slug:          sr.Slug,
		Description:   sr.Description,
		CategoryID:    sr.CategoryID,
		PosterURL:     sr.PosterURL,
		BackdropURL:   sr.BackdropURL,
		Year:          sr.Year,
		Rating:        sr.Rating,
		TotalSeasons:  sr.TotalSeasons,
		IsActive:      sr.IsActive,
		EpisodesCount: episodesCount,
		CreatedAt:     sr.CreatedAt,
	}
	if sr.Category != nil {
		cat := toCategoryResponse(*sr.Category)
		resp.Category = &cat
	}
	return resp
}

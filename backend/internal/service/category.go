package service

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
)

type CategoryService struct {
	repo  CategoryRepositoryInterface
	cache CacheServiceInterface
}

func NewCategoryService(repo CategoryRepositoryInterface, cacheService CacheServiceInterface) *CategoryService {
	return &CategoryService{repo: repo, cache: cacheService}
}

func (s *CategoryService) List(page, perPage int) ([]dto.CategoryResponse, int64, error) {
	categories, total, err := s.repo.List(page, perPage)
	if err != nil {
		return nil, 0, err
	}

	var result []dto.CategoryResponse
	for _, c := range categories {
		result = append(result, toCategoryResponse(c))
	}
	return result, total, nil
}

func (s *CategoryService) ListByType(categoryType string) ([]dto.CategoryResponse, error) {
	// Try cache first
	cacheKey := fmt.Sprintf("categories:%s", categoryType)
	var cached []dto.CategoryResponse
	if s.cache != nil && s.cache.Get(cacheKey, &cached) {
		return cached, nil
	}

	categories, err := s.repo.ListByType(categoryType)
	if err != nil {
		return nil, err
	}

	var result []dto.CategoryResponse
	for _, c := range categories {
		result = append(result, toCategoryResponse(c))
	}

	// Store in cache (5 minutes)
	if s.cache != nil && result != nil {
		s.cache.Set(cacheKey, result, 5*time.Minute)
	}
	return result, nil
}

func (s *CategoryService) invalidateCache() {
	if s.cache != nil {
		s.cache.DeletePrefix("categories:")
	}
}

func (s *CategoryService) GetByID(id uint) (*dto.CategoryResponse, error) {
	category, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("categoria no encontrada")
	}
	resp := toCategoryResponse(*category)
	return &resp, nil
}

func (s *CategoryService) Create(req dto.CreateCategoryRequest) (*dto.CategoryResponse, error) {
	if req.Name == "" {
		return nil, errors.New("nombre es requerido")
	}
	if req.Type == "" {
		return nil, errors.New("tipo es requerido")
	}
	validTypes := map[string]bool{"live": true, "vod": true, "series": true}
	if !validTypes[req.Type] {
		return nil, errors.New("tipo debe ser 'live', 'vod' o 'series'")
	}

	slug := req.Slug
	if slug == "" {
		slug = generateSlug(req.Name)
	}

	category := &model.Category{
		Name:      req.Name,
		Slug:      slug,
		Type:      req.Type,
		ParentID:  req.ParentID,
		SortOrder: req.SortOrder,
	}

	if err := s.repo.Create(category); err != nil {
		return nil, errors.New("error creando categoria")
	}

	s.invalidateCache()
	resp := toCategoryResponse(*category)
	return &resp, nil
}

func (s *CategoryService) Update(id uint, req dto.UpdateCategoryRequest) (*dto.CategoryResponse, error) {
	category, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("categoria no encontrada")
	}

	if req.Name != "" {
		category.Name = req.Name
	}
	if req.Slug != "" {
		category.Slug = req.Slug
	}
	if req.Type != "" {
		validTypes := map[string]bool{"live": true, "vod": true, "series": true}
		if !validTypes[req.Type] {
			return nil, errors.New("tipo debe ser 'live', 'vod' o 'series'")
		}
		category.Type = req.Type
	}
	category.ParentID = req.ParentID
	if req.SortOrder != nil {
		category.SortOrder = *req.SortOrder
	}

	if err := s.repo.Update(category); err != nil {
		return nil, errors.New("error actualizando categoria")
	}

	s.invalidateCache()
	resp := toCategoryResponse(*category)
	return &resp, nil
}

func (s *CategoryService) Delete(id uint) error {
	err := s.repo.Delete(id)
	if err == nil {
		s.invalidateCache()
	}
	return err
}

func toCategoryResponse(c model.Category) dto.CategoryResponse {
	return dto.CategoryResponse{
		ID:        c.ID,
		Name:      c.Name,
		Slug:      c.Slug,
		Type:      c.Type,
		ParentID:  c.ParentID,
		SortOrder: c.SortOrder,
		CreatedAt: c.CreatedAt,
	}
}

func generateSlug(name string) string {
	slug := strings.ToLower(name)
	slug = strings.ReplaceAll(slug, " ", "-")
	reg := regexp.MustCompile(`[^a-z0-9\-]`)
	slug = reg.ReplaceAllString(slug, "")
	reg = regexp.MustCompile(`-+`)
	slug = reg.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	return slug
}

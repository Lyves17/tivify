package service

import (
	"errors"

	"github.com/google/uuid"
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

type FavoriteService struct {
	favRepo     FavoriteRepositoryInterface
	channelRepo ChannelRepositoryInterface
	vodRepo     VODRepositoryInterface
	seriesRepo  SeriesRepositoryInterface
}

func NewFavoriteService(
	favRepo FavoriteRepositoryInterface,
	channelRepo ChannelRepositoryInterface,
	vodRepo VODRepositoryInterface,
	seriesRepo SeriesRepositoryInterface,
) *FavoriteService {
	return &FavoriteService{
		favRepo:     favRepo,
		channelRepo: channelRepo,
		vodRepo:     vodRepo,
		seriesRepo:  seriesRepo,
	}
}

type FavoriteItem struct {
	ID              uint   `json:"id"`
	FavoritableType string `json:"favoritable_type"`
	FavoritableID   uint   `json:"favoritable_id"`
	CreatedAt       string `json:"created_at"`
	ContentName     string `json:"content_name"`
	ContentPoster   string `json:"content_poster"`
	ContentSlug     string `json:"content_slug"`
}

func (s *FavoriteService) ListByUser(userID uuid.UUID, page, perPage int) ([]FavoriteItem, int64, error) {
	favorites, total, err := s.favRepo.ListByUser(userID, page, perPage)
	if err != nil {
		return nil, 0, err
	}
	var result []FavoriteItem
	for _, f := range favorites {
		item := FavoriteItem{
			ID:              f.ID,
			FavoritableType: f.FavoritableType,
			FavoritableID:   f.FavoritableID,
			CreatedAt:       f.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}

		switch f.FavoritableType {
		case "channel":
			if ch, err := s.channelRepo.FindByID(f.FavoritableID); err == nil {
				item.ContentName = ch.Name
				item.ContentPoster = ch.LogoURL
				item.ContentSlug = ch.Slug
			} else {
				item.ContentName = "(eliminado)"
			}
		case "vod":
			if v, err := s.vodRepo.FindByID(f.FavoritableID); err == nil {
				item.ContentName = v.Title
				item.ContentPoster = v.PosterURL
				item.ContentSlug = v.Slug
			} else {
				item.ContentName = "(eliminado)"
			}
		case "series":
			if sr, err := s.seriesRepo.FindByID(f.FavoritableID); err == nil {
				item.ContentName = sr.Title
				item.ContentPoster = sr.PosterURL
				item.ContentSlug = sr.Slug
			} else {
				item.ContentName = "(eliminado)"
			}
		}

		result = append(result, item)
	}
	return result, total, nil
}

// Toggle agrega o quita un favorito. Retorna true si se agrego, false si se quito.
func (s *FavoriteService) Toggle(userID uuid.UUID, favType string, favID uint) (bool, error) {
	if favType != "channel" && favType != "vod" && favType != "series" {
		return false, errors.New("tipo invalido")
	}

	existing, err := s.favRepo.FindByUserAndItem(userID, favType, favID)
	if err == nil && existing != nil {
		if err := s.favRepo.DeleteByUserAndItem(userID, favType, favID); err != nil {
			return false, errors.New("error eliminando favorito")
		}
		return false, nil
	}

	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, errors.New("error buscando favorito")
	}

	fav := &model.Favorite{
		UserID:          userID,
		FavoritableType: favType,
		FavoritableID:   favID,
	}
	if err := s.favRepo.Create(fav); err != nil {
		return false, errors.New("error creando favorito")
	}
	return true, nil
}

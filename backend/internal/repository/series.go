package repository

import (
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

type SeriesRepository struct {
	db *gorm.DB
}

func NewSeriesRepository(db *gorm.DB) *SeriesRepository {
	return &SeriesRepository{db: db}
}

func (r *SeriesRepository) FindByID(id uint) (*model.Series, error) {
	var series model.Series
	err := r.db.Preload("Category").First(&series, id).Error
	return &series, err
}

func (r *SeriesRepository) FindBySlug(slug string) (*model.Series, error) {
	var series model.Series
	err := r.db.Preload("Category").Where("slug = ?", slug).First(&series).Error
	return &series, err
}

func (r *SeriesRepository) List(page, perPage int) ([]model.Series, int64, error) {
	var series []model.Series
	var total int64

	r.db.Model(&model.Series{}).Count(&total)

	offset := (page - 1) * perPage
	err := r.db.Preload("Category").
		Offset(offset).Limit(perPage).
		Order("created_at DESC").
		Find(&series).Error
	return series, total, err
}

func (r *SeriesRepository) ListActive(page, perPage int, search string, categoryID *uint) ([]model.Series, int64, error) {
	var series []model.Series
	var total int64

	scope := func(db *gorm.DB) *gorm.DB {
		db = db.Where("is_active = ?", true)
		if search != "" {
			db = applyFTSSearch(db, search, "title")
		}
		if categoryID != nil {
			db = db.Where("category_id = ?", *categoryID)
		}
		return db
	}

	r.db.Model(&model.Series{}).Scopes(scope).Count(&total)

	offset := (page - 1) * perPage
	query := r.db.Preload("Category").Scopes(scope).
		Offset(offset).Limit(perPage)
	if search != "" {
		query = query.Order(ftsOrderClause(search, "created_at DESC"))
	} else {
		query = query.Order("created_at DESC")
	}
	err := query.Find(&series).Error
	return series, total, err
}

func (r *SeriesRepository) Create(series *model.Series) error {
	return r.db.Create(series).Error
}

func (r *SeriesRepository) Update(series *model.Series) error {
	return r.db.Save(series).Error
}

func (r *SeriesRepository) Delete(id uint) error {
	return r.db.Delete(&model.Series{}, id).Error
}

func (r *SeriesRepository) Count() (int64, error) {
	var count int64
	err := r.db.Model(&model.Series{}).Count(&count).Error
	return count, err
}

func (r *SeriesRepository) CountActive() (int64, error) {
	var count int64
	err := r.db.Model(&model.Series{}).Where("is_active = ?", true).Count(&count).Error
	return count, err
}

func (r *SeriesRepository) CountEpisodes(seriesID uint) (int64, error) {
	var count int64
	err := r.db.Model(&model.VOD{}).Where("series_id = ?", seriesID).Count(&count).Error
	return count, err
}

// ListWithoutPoster devuelve series sin poster para enriquecimiento TMDB
func (r *SeriesRepository) ListWithoutPoster() ([]model.Series, error) {
	var series []model.Series
	err := r.db.Where("poster_url = '' OR poster_url IS NULL").
		Order("created_at DESC").
		Find(&series).Error
	return series, err
}

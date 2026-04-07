package repository

import (
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

type VODRepository struct {
	db *gorm.DB
}

func NewVODRepository(db *gorm.DB) *VODRepository {
	return &VODRepository{db: db}
}

func (r *VODRepository) FindByID(id uint) (*model.VOD, error) {
	var vod model.VOD
	err := r.db.Preload("Category").First(&vod, id).Error
	return &vod, err
}

func (r *VODRepository) FindBySlug(slug string) (*model.VOD, error) {
	var vod model.VOD
	err := r.db.Preload("Category").Where("slug = ?", slug).First(&vod).Error
	return &vod, err
}

func (r *VODRepository) List(page, perPage int) ([]model.VOD, int64, error) {
	var vods []model.VOD
	var total int64

	r.db.Model(&model.VOD{}).Count(&total)

	offset := (page - 1) * perPage
	err := r.db.Preload("Category").
		Offset(offset).Limit(perPage).
		Order("created_at DESC").
		Find(&vods).Error
	return vods, total, err
}

func (r *VODRepository) ListActive(page, perPage int, search string, categoryID *uint) ([]model.VOD, int64, error) {
	var vods []model.VOD
	var total int64

	scope := func(db *gorm.DB) *gorm.DB {
		db = db.Where("is_active = ? AND series_id IS NULL", true)
		if search != "" {
			db = applyFTSSearch(db, search, "title")
		}
		if categoryID != nil {
			db = db.Where("category_id = ?", *categoryID)
		}
		return db
	}

	r.db.Model(&model.VOD{}).Scopes(scope).Count(&total)

	offset := (page - 1) * perPage
	query := r.db.Preload("Category").Scopes(scope).
		Offset(offset).Limit(perPage)
	if search != "" {
		query = query.Order(ftsOrderClause(search, "created_at DESC"))
	} else {
		query = query.Order("created_at DESC")
	}
	err := query.Find(&vods).Error
	return vods, total, err
}

func (r *VODRepository) ListBySeries(seriesID uint) ([]model.VOD, error) {
	var vods []model.VOD
	err := r.db.Where("series_id = ?", seriesID).
		Order("season_number ASC, episode_number ASC").
		Find(&vods).Error
	return vods, err
}

func (r *VODRepository) Create(vod *model.VOD) error {
	return r.db.Create(vod).Error
}

func (r *VODRepository) Update(vod *model.VOD) error {
	return r.db.Save(vod).Error
}

func (r *VODRepository) Delete(id uint) error {
	return r.db.Delete(&model.VOD{}, id).Error
}

func (r *VODRepository) Count() (int64, error) {
	var count int64
	err := r.db.Model(&model.VOD{}).Count(&count).Error
	return count, err
}

func (r *VODRepository) CountActive() (int64, error) {
	var count int64
	err := r.db.Model(&model.VOD{}).Where("is_active = ? AND series_id IS NULL", true).Count(&count).Error
	return count, err
}

func (r *VODRepository) ListRecent(limit int) ([]model.VOD, error) {
	var vods []model.VOD
	err := r.db.Order("created_at DESC").Limit(limit).Find(&vods).Error
	return vods, err
}

func (r *VODRepository) ListByTranscodeStatus(statuses []string) ([]model.VOD, error) {
	var vods []model.VOD
	err := r.db.Where("transcode_status IN ?", statuses).
		Order("updated_at DESC").
		Find(&vods).Error
	return vods, err
}

// ListWithoutPoster devuelve VODs standalone (no episodios) sin poster
func (r *VODRepository) ListWithoutPoster() ([]model.VOD, error) {
	var vods []model.VOD
	err := r.db.Where("(poster_url = '' OR poster_url IS NULL) AND series_id IS NULL").
		Order("created_at DESC").
		Find(&vods).Error
	return vods, err
}

// DebugAll devuelve todos los VODs sin filtros para diagnostico
func (r *VODRepository) DebugAll() ([]model.VOD, error) {
	var vods []model.VOD
	err := r.db.Order("created_at DESC").Find(&vods).Error
	return vods, err
}

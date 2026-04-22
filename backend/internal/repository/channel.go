package repository

import (
	"fmt"

	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

// applyFTSSearch uses PostgreSQL Full-Text Search with fallback to ILIKE.
// For queries 3+ chars, uses tsvector/tsquery with ILIKE OR fallback.
// For very short queries (1-2 chars), falls back to ILIKE only.
func applyFTSSearch(db *gorm.DB, search string, ilikeFallbackCol string) *gorm.DB {
	if len(search) < 3 {
		return db.Where(ilikeFallbackCol+" ILIKE ?", "%"+search+"%")
	}
	return db.Where("search_vector @@ plainto_tsquery('spanish', ?) OR "+ilikeFallbackCol+" ILIKE ?", search, "%"+search+"%")
}

// ftsOrderClause returns an ORDER BY clause that ranks FTS results first.
func ftsOrderClause(search string, fallbackOrder string) string {
	return fmt.Sprintf("ts_rank(search_vector, plainto_tsquery('spanish', '%s')) DESC, %s",
		sanitizeForSQL(search), fallbackOrder)
}

// maxFTSSearchLen caps the length of the search term interpolated into
// ORDER BY clauses. Arbitrarily large queries aren't useful for ts_rank
// and keeping a cap reduces the blast radius of any future sanitization bug.
const maxFTSSearchLen = 200

// sanitizeForSQL escapes characters that have special meaning inside single-quoted
// PostgreSQL string literals so the result can be safely embedded in an
// ORDER BY expression. It escapes:
//   - single quote (') → ” (SQL standard escape)
//   - backslash (\)   → \\ (needed when standard_conforming_strings is off)
//
// and drops NUL bytes and other control characters entirely.
// Input is also truncated to maxFTSSearchLen to cap worst-case cost.
func sanitizeForSQL(s string) string {
	if len(s) > maxFTSSearchLen {
		s = s[:maxFTSSearchLen]
	}
	result := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c == '\'':
			result = append(result, '\'', '\'')
		case c == '\\':
			result = append(result, '\\', '\\')
		case c < 0x20 || c == 0x7f:
			// drop NUL and other control characters (newline, tab, etc. included
			// since they have no meaning inside a short search query)
			continue
		default:
			result = append(result, c)
		}
	}
	return string(result)
}

type ChannelRepository struct {
	db *gorm.DB
}

func NewChannelRepository(db *gorm.DB) *ChannelRepository {
	return &ChannelRepository{db: db}
}

func (r *ChannelRepository) FindByID(id uint) (*model.Channel, error) {
	var channel model.Channel
	err := r.db.Preload("Category").Preload("Streams").First(&channel, id).Error
	return &channel, err
}

func (r *ChannelRepository) FindBySlug(slug string) (*model.Channel, error) {
	var channel model.Channel
	err := r.db.Preload("Category").Preload("Streams").Where("slug = ?", slug).First(&channel).Error
	return &channel, err
}

func (r *ChannelRepository) List(page, perPage int) ([]model.Channel, int64, error) {
	var channels []model.Channel
	var total int64

	r.db.Model(&model.Channel{}).Count(&total)

	offset := (page - 1) * perPage
	err := r.db.Preload("Category").Preload("Streams").
		Offset(offset).Limit(perPage).
		Order("channel_number ASC NULLS LAST, name ASC").
		Find(&channels).Error
	return channels, total, err
}

func (r *ChannelRepository) ListActive(page, perPage int, search string, categoryID *uint) ([]model.Channel, int64, error) {
	var channels []model.Channel
	var total int64

	scope := func(db *gorm.DB) *gorm.DB {
		db = db.Where("is_active = ?", true)
		if search != "" {
			db = applyFTSSearch(db, search, "name")
		}
		if categoryID != nil {
			db = db.Where("category_id = ?", *categoryID)
		}
		return db
	}

	r.db.Model(&model.Channel{}).Scopes(scope).Count(&total)

	offset := (page - 1) * perPage
	query := r.db.Preload("Category").Scopes(scope).
		Offset(offset).Limit(perPage)
	if search != "" {
		query = query.Order(ftsOrderClause(search, "channel_number ASC NULLS LAST, name ASC"))
	} else {
		query = query.Order("channel_number ASC NULLS LAST, name ASC")
	}
	err := query.Find(&channels).Error
	return channels, total, err
}

func (r *ChannelRepository) Create(channel *model.Channel) error {
	return r.db.Create(channel).Error
}

func (r *ChannelRepository) Update(channel *model.Channel) error {
	return r.db.Save(channel).Error
}

func (r *ChannelRepository) Delete(id uint) error {
	return r.db.Delete(&model.Channel{}, id).Error
}

func (r *ChannelRepository) Count() (int64, error) {
	var count int64
	err := r.db.Model(&model.Channel{}).Count(&count).Error
	return count, err
}

func (r *ChannelRepository) CountActive() (int64, error) {
	var count int64
	err := r.db.Model(&model.Channel{}).Where("is_active = ?", true).Count(&count).Error
	return count, err
}

// CountBySource devuelve el número de canales de una fuente específica.
// Los canales manuales tienen source = "".
func (r *ChannelRepository) CountBySource(source string) (int64, error) {
	var count int64
	err := r.db.Model(&model.Channel{}).Where("source = ?", source).Count(&count).Error
	return count, err
}

// DeleteBySource elimina (soft-delete) todos los canales de una fuente específica.
// NUNCA borra canales con source = "" (manuales) por seguridad.
func (r *ChannelRepository) DeleteBySource(source string) error {
	if source == "" {
		return nil // protección: nunca borrar canales manuales
	}
	return r.db.Where("source = ?", source).Delete(&model.Channel{}).Error
}

package repository

import (
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

type CategoryRepository struct {
	db *gorm.DB
}

func NewCategoryRepository(db *gorm.DB) *CategoryRepository {
	return &CategoryRepository{db: db}
}

func (r *CategoryRepository) FindByID(id uint) (*model.Category, error) {
	var category model.Category
	err := r.db.First(&category, id).Error
	return &category, err
}

func (r *CategoryRepository) FindBySlug(slug string) (*model.Category, error) {
	var category model.Category
	err := r.db.Where("slug = ?", slug).First(&category).Error
	return &category, err
}

func (r *CategoryRepository) List(page, perPage int) ([]model.Category, int64, error) {
	var categories []model.Category
	var total int64

	r.db.Model(&model.Category{}).Count(&total)

	offset := (page - 1) * perPage
	err := r.db.Offset(offset).Limit(perPage).Order("sort_order ASC, name ASC").Find(&categories).Error
	return categories, total, err
}

func (r *CategoryRepository) ListByType(categoryType string) ([]model.Category, error) {
	var categories []model.Category
	err := r.db.Where("type = ?", categoryType).Order("sort_order ASC, name ASC").Find(&categories).Error
	return categories, err
}

func (r *CategoryRepository) Create(category *model.Category) error {
	return r.db.Create(category).Error
}

func (r *CategoryRepository) Update(category *model.Category) error {
	return r.db.Save(category).Error
}

func (r *CategoryRepository) Delete(id uint) error {
	return r.db.Delete(&model.Category{}, id).Error
}

func (r *CategoryRepository) Count() (int64, error) {
	var count int64
	err := r.db.Model(&model.Category{}).Count(&count).Error
	return count, err
}

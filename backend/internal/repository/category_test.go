package repository

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/tivify/backend/internal/model"
)

func categoryColumns() []string {
	return []string{"id", "name", "slug", "type", "parent_id", "sort_order", "created_at", "updated_at"}
}

func TestCategoryRepository_FindByID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewCategoryRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "categories" WHERE "categories"\."id" = \$1`).
		WithArgs(1, 1).
		WillReturnRows(sqlmock.NewRows(categoryColumns()).
			AddRow(1, "Deportes", "deportes", "live", nil, 0, now, now))

	cat, err := repo.FindByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cat.Name != "Deportes" {
		t.Errorf("expected name 'Deportes', got %q", cat.Name)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestCategoryRepository_FindBySlug(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewCategoryRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "categories" WHERE slug = \$1`).
		WithArgs("news", 1).
		WillReturnRows(sqlmock.NewRows(categoryColumns()).
			AddRow(2, "News", "news", "live", nil, 1, now, now))

	cat, err := repo.FindBySlug("news")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cat.Slug != "news" {
		t.Errorf("expected slug 'news', got %q", cat.Slug)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestCategoryRepository_Create(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewCategoryRepository(db)

	cat := &model.Category{
		Name:      "New Category",
		Slug:      "new-category",
		Type:      "vod",
		SortOrder: 5,
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "categories"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	err := repo.Create(cat)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestCategoryRepository_Count(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewCategoryRepository(db)

	mock.ExpectQuery(`SELECT count\(\*\) FROM "categories"`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(10))

	count, err := repo.Count()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 10 {
		t.Errorf("expected count 10, got %d", count)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestCategoryRepository_ListByType(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewCategoryRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "categories" WHERE type = \$1`).
		WithArgs("live").
		WillReturnRows(sqlmock.NewRows(categoryColumns()).
			AddRow(1, "Sports", "sports", "live", nil, 0, now, now).
			AddRow(2, "News", "news", "live", nil, 1, now, now))

	categories, err := repo.ListByType("live")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(categories) != 2 {
		t.Errorf("expected 2 categories, got %d", len(categories))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestCategoryRepository_List(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewCategoryRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT count\(\*\) FROM "categories"`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

	mock.ExpectQuery(`SELECT \* FROM "categories"`).
		WillReturnRows(sqlmock.NewRows(categoryColumns()).
			AddRow(1, "Sports", "sports", "live", nil, 0, now, now).
			AddRow(2, "News", "news", "live", nil, 1, now, now))

	categories, total, err := repo.List(1, 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 2 {
		t.Errorf("expected total 2, got %d", total)
	}
	if len(categories) != 2 {
		t.Errorf("expected 2 categories, got %d", len(categories))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestCategoryRepository_Update(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewCategoryRepository(db)

	now := time.Now()
	cat := &model.Category{
		ID:        1,
		Name:      "Updated Sports",
		Slug:      "updated-sports",
		Type:      "live",
		CreatedAt: now,
		UpdatedAt: now,
	}

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "categories" SET`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Update(cat)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestCategoryRepository_Delete(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewCategoryRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "categories" WHERE "categories"\."id" = \$1`).
		WithArgs(1).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.Delete(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

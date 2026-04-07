package repository

import (
	"database/sql/driver"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/tivify/backend/internal/model"
)

func seriesColumns() []string {
	return []string{"id", "title", "slug", "description", "category_id", "poster_url", "backdrop_url", "year", "rating", "total_seasons", "is_active", "created_at", "updated_at", "deleted_at"}
}

func newSeriesRow(id uint, title, slug string, now time.Time) []driver.Value {
	return []driver.Value{id, title, slug, "A great series", nil, "http://poster.jpg", "http://backdrop.jpg", 2024, 9.0, 3, true, now, now, nil}
}

func TestSeriesRepository_FindByID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSeriesRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "series" WHERE "series"\."id" = \$1 .*`).
		WithArgs(1, 1).
		WillReturnRows(sqlmock.NewRows(seriesColumns()).AddRow(newSeriesRow(1, "Breaking Bad", "breaking-bad", now)...))

	series, err := repo.FindByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if series.Title != "Breaking Bad" {
		t.Errorf("expected title 'Breaking Bad', got %q", series.Title)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSeriesRepository_FindByID_NotFound(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSeriesRepository(db)

	mock.ExpectQuery(`SELECT \* FROM "series" WHERE "series"\."id" = \$1 .*`).
		WithArgs(999, 1).
		WillReturnRows(sqlmock.NewRows(seriesColumns()))

	_, err := repo.FindByID(999)
	if err == nil {
		t.Error("expected error for nonexistent series")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSeriesRepository_FindBySlug(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSeriesRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "series" WHERE slug = \$1 .*`).
		WithArgs("the-wire", 1).
		WillReturnRows(sqlmock.NewRows(seriesColumns()).AddRow(newSeriesRow(2, "The Wire", "the-wire", now)...))

	series, err := repo.FindBySlug("the-wire")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if series.Slug != "the-wire" {
		t.Errorf("expected slug 'the-wire', got %q", series.Slug)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSeriesRepository_List(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSeriesRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT count\(\*\) FROM "series".*`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	mock.ExpectQuery(`SELECT \* FROM "series".*`).
		WillReturnRows(sqlmock.NewRows(seriesColumns()).AddRow(newSeriesRow(1, "Series1", "series1", now)...))

	series, total, err := repo.List(1, 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(series) != 1 {
		t.Errorf("expected 1 series, got %d", len(series))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSeriesRepository_Create(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSeriesRepository(db)

	series := &model.Series{
		Title:    "New Series",
		Slug:     "new-series",
		IsActive: true,
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "series"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	err := repo.Create(series)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSeriesRepository_Update(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSeriesRepository(db)

	now := time.Now()
	series := &model.Series{
		ID:        1,
		Title:     "Updated Series",
		Slug:      "updated-series",
		IsActive:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "series" SET`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Update(series)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSeriesRepository_Delete(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSeriesRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "series" SET "deleted_at"=\$1 WHERE "series"\."id" = \$2.*`).
		WithArgs(sqlmock.AnyArg(), 1).
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

func TestSeriesRepository_Count(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSeriesRepository(db)

	mock.ExpectQuery(`SELECT count\(\*\) FROM "series".*`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(8))

	count, err := repo.Count()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 8 {
		t.Errorf("expected count 8, got %d", count)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSeriesRepository_CountActive(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSeriesRepository(db)

	mock.ExpectQuery(`SELECT count\(\*\) FROM "series" WHERE .*is_active.*`).
		WithArgs(true).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(6))

	count, err := repo.CountActive()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 6 {
		t.Errorf("expected count 6, got %d", count)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSeriesRepository_CountEpisodes(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSeriesRepository(db)

	mock.ExpectQuery(`SELECT count\(\*\) FROM "vods" WHERE .*series_id.*`).
		WithArgs(1).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(12))

	count, err := repo.CountEpisodes(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 12 {
		t.Errorf("expected count 12, got %d", count)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSeriesRepository_ListWithoutPoster(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSeriesRepository(db)

	now := time.Now()
	row := []driver.Value{1, "No Poster Series", "no-poster-series", "desc", nil, "", "", 2024, 7.5, 2, true, now, now, nil}

	mock.ExpectQuery(`SELECT \* FROM "series" WHERE .*poster_url.*`).
		WillReturnRows(sqlmock.NewRows(seriesColumns()).AddRow(row...))

	series, err := repo.ListWithoutPoster()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(series) != 1 {
		t.Errorf("expected 1 series, got %d", len(series))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func newSeriesRowWithCat(id uint, title, slug string, catID uint, now time.Time) []driver.Value {
	return []driver.Value{id, title, slug, "A great series", catID, "http://poster.jpg", "http://backdrop.jpg", 2024, 9.0, 3, true, now, now, nil}
}

func TestSeriesRepository_ListActive(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSeriesRepository(db)

	now := time.Now()
	mock.ExpectQuery(`SELECT count\(\*\) FROM "series" WHERE is_active`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(`SELECT \* FROM "series" WHERE is_active`).
		WillReturnRows(sqlmock.NewRows(seriesColumns()).AddRow(newSeriesRowWithCat(1, "Breaking Bad", "breaking-bad", 1, now)...))
	mock.ExpectQuery(`SELECT \* FROM "categories"`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "slug", "type", "created_at", "updated_at", "deleted_at"}))

	series, total, err := repo.ListActive(1, 10, "", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(series) != 1 {
		t.Errorf("expected 1 series, got %d", len(series))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSeriesRepository_ListActive_WithSearch(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSeriesRepository(db)

	now := time.Now()
	mock.ExpectQuery(`SELECT count\(\*\) FROM "series" WHERE is_active .* AND \(search_vector`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(`SELECT \* FROM "series" WHERE is_active .* AND \(search_vector`).
		WillReturnRows(sqlmock.NewRows(seriesColumns()).AddRow(newSeriesRowWithCat(1, "Breaking Bad", "breaking-bad", 1, now)...))
	mock.ExpectQuery(`SELECT \* FROM "categories"`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "slug", "type", "created_at", "updated_at", "deleted_at"}))

	series, total, err := repo.ListActive(1, 10, "breaking", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(series) != 1 {
		t.Errorf("expected 1 series, got %d", len(series))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

package repository

import (
	"database/sql/driver"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/tivify/backend/internal/model"
)

func vodColumns() []string {
	return []string{"id", "title", "slug", "description", "category_id", "duration", "poster_url", "backdrop_url", "original_filename", "hls_path", "transcode_status", "transcode_progress", "file_size", "resolution", "year", "rating", "is_active", "series_id", "season_number", "episode_number", "created_at", "updated_at", "deleted_at"}
}

func newVODRow(id uint, title, slug string, now time.Time) []driver.Value {
	return []driver.Value{id, title, slug, "desc", nil, 3600, "http://poster.jpg", "http://backdrop.jpg", "movie.mp4", "/hls/movie/index.m3u8", "completed", 100, int64(1024000), "1080p", 2024, 8.5, true, nil, 0, 0, now, now, nil}
}

func TestVODRepository_FindByID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewVODRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "vods" WHERE "vods"\."id" = \$1 .*`).
		WithArgs(1, 1).
		WillReturnRows(sqlmock.NewRows(vodColumns()).AddRow(newVODRow(1, "Movie", "movie", now)...))

	vod, err := repo.FindByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if vod.Title != "Movie" {
		t.Errorf("expected title 'Movie', got %q", vod.Title)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestVODRepository_FindByID_NotFound(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewVODRepository(db)

	mock.ExpectQuery(`SELECT \* FROM "vods" WHERE "vods"\."id" = \$1 .*`).
		WithArgs(999, 1).
		WillReturnRows(sqlmock.NewRows(vodColumns()))

	_, err := repo.FindByID(999)
	if err == nil {
		t.Error("expected error for nonexistent vod")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestVODRepository_FindBySlug(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewVODRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "vods" WHERE slug = \$1 .*`).
		WithArgs("my-movie", 1).
		WillReturnRows(sqlmock.NewRows(vodColumns()).AddRow(newVODRow(1, "My Movie", "my-movie", now)...))

	vod, err := repo.FindBySlug("my-movie")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if vod.Slug != "my-movie" {
		t.Errorf("expected slug 'my-movie', got %q", vod.Slug)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestVODRepository_List(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewVODRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT count\(\*\) FROM "vods".*`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	mock.ExpectQuery(`SELECT \* FROM "vods".*`).
		WillReturnRows(sqlmock.NewRows(vodColumns()).AddRow(newVODRow(1, "Movie", "movie", now)...))

	vods, total, err := repo.List(1, 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(vods) != 1 {
		t.Errorf("expected 1 vod, got %d", len(vods))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestVODRepository_Create(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewVODRepository(db)

	vod := &model.VOD{
		Title:           "New Movie",
		Slug:            "new-movie",
		TranscodeStatus: "pending",
		IsActive:        true,
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "vods"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	err := repo.Create(vod)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestVODRepository_Update(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewVODRepository(db)

	now := time.Now()
	vod := &model.VOD{
		ID:              1,
		Title:           "Updated Movie",
		Slug:            "updated-movie",
		TranscodeStatus: "completed",
		IsActive:        true,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "vods" SET`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Update(vod)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestVODRepository_Delete(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewVODRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "vods" SET "deleted_at"=\$1 WHERE "vods"\."id" = \$2.*`).
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

func TestVODRepository_Count(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewVODRepository(db)

	mock.ExpectQuery(`SELECT count\(\*\) FROM "vods".*`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(25))

	count, err := repo.Count()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 25 {
		t.Errorf("expected count 25, got %d", count)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestVODRepository_CountActive(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewVODRepository(db)

	mock.ExpectQuery(`SELECT count\(\*\) FROM "vods" WHERE .*is_active.*`).
		WithArgs(true).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(20))

	count, err := repo.CountActive()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 20 {
		t.Errorf("expected count 20, got %d", count)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestVODRepository_ListRecent(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewVODRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "vods" .*`).
		WillReturnRows(sqlmock.NewRows(vodColumns()).
			AddRow(newVODRow(1, "Recent", "recent", now)...))

	vods, err := repo.ListRecent(5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(vods) != 1 {
		t.Errorf("expected 1 vod, got %d", len(vods))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestVODRepository_ListByTranscodeStatus(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewVODRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "vods" WHERE transcode_status IN \(\$1,\$2\).*`).
		WithArgs("pending", "processing").
		WillReturnRows(sqlmock.NewRows(vodColumns()).
			AddRow(newVODRow(1, "Pending Movie", "pending-movie", now)...))

	vods, err := repo.ListByTranscodeStatus([]string{"pending", "processing"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(vods) != 1 {
		t.Errorf("expected 1 vod, got %d", len(vods))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestVODRepository_ListWithoutPoster(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewVODRepository(db)

	now := time.Now()
	row := []driver.Value{1, "No Poster", "no-poster", "desc", nil, 3600, "", "", "movie.mp4", "/hls/index.m3u8", "completed", 100, int64(1024000), "1080p", 2024, 8.5, true, nil, 0, 0, now, now, nil}

	mock.ExpectQuery(`SELECT \* FROM "vods" WHERE .*poster_url.*`).
		WillReturnRows(sqlmock.NewRows(vodColumns()).AddRow(row...))

	vods, err := repo.ListWithoutPoster()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(vods) != 1 {
		t.Errorf("expected 1 vod, got %d", len(vods))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestVODRepository_DebugAll(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewVODRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "vods".*`).
		WillReturnRows(sqlmock.NewRows(vodColumns()).
			AddRow(newVODRow(1, "Movie1", "movie1", now)...).
			AddRow(newVODRow(2, "Movie2", "movie2", now)...))

	vods, err := repo.DebugAll()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(vods) != 2 {
		t.Errorf("expected 2 vods, got %d", len(vods))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestVODRepository_ListBySeries(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewVODRepository(db)

	now := time.Now()
	seriesID := uint(5)
	row := []driver.Value{1, "Episode 1", "ep-1", "desc", nil, 2400, "http://poster.jpg", "", "ep1.mp4", "/hls/ep1/index.m3u8", "completed", 100, int64(512000), "1080p", 2024, 8.0, true, &seriesID, 1, 1, now, now, nil}

	mock.ExpectQuery(`SELECT \* FROM "vods" WHERE series_id = \$1.*`).
		WithArgs(5).
		WillReturnRows(sqlmock.NewRows(vodColumns()).AddRow(row...))

	vods, err := repo.ListBySeries(5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(vods) != 1 {
		t.Errorf("expected 1 vod, got %d", len(vods))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func newVODRowWithCat(id uint, title, slug string, catID uint, now time.Time) []driver.Value {
	return []driver.Value{id, title, slug, "desc", catID, 3600, "http://poster.jpg", "http://backdrop.jpg", "movie.mp4", "/hls/movie/index.m3u8", "completed", 100, int64(1024000), "1080p", 2024, 8.5, true, nil, 0, 0, now, now, nil}
}

func TestVODRepository_ListActive(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewVODRepository(db)

	now := time.Now()
	mock.ExpectQuery(`SELECT count\(\*\) FROM "vods" WHERE \(is_active .* AND series_id IS NULL\)`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(`SELECT \* FROM "vods" WHERE \(is_active .* AND series_id IS NULL\)`).
		WillReturnRows(sqlmock.NewRows(vodColumns()).AddRow(newVODRowWithCat(1, "Movie", "movie", 1, now)...))
	mock.ExpectQuery(`SELECT \* FROM "categories"`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "slug", "type", "created_at", "updated_at", "deleted_at"}))

	vods, total, err := repo.ListActive(1, 10, "", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(vods) != 1 {
		t.Errorf("expected 1 vod, got %d", len(vods))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestVODRepository_ListActive_WithSearch(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewVODRepository(db)

	now := time.Now()
	mock.ExpectQuery(`SELECT count\(\*\) FROM "vods" WHERE \(is_active .* AND series_id IS NULL\) AND \(search_vector`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(`SELECT \* FROM "vods" WHERE \(is_active .* AND series_id IS NULL\) AND \(search_vector`).
		WillReturnRows(sqlmock.NewRows(vodColumns()).AddRow(newVODRowWithCat(1, "Action Movie", "action-movie", 1, now)...))
	mock.ExpectQuery(`SELECT \* FROM "categories"`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "slug", "type", "created_at", "updated_at", "deleted_at"}))

	vods, total, err := repo.ListActive(1, 10, "action", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(vods) != 1 {
		t.Errorf("expected 1 vod, got %d", len(vods))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

package repository

import (
	"database/sql/driver"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/tivify/backend/internal/model"
)

func libraryScanColumns() []string {
	return []string{
		"id", "scan_session_id", "file_path", "file_name", "file_size",
		"parsed_title", "parsed_year", "media_type", "season_number", "episode_number",
		"duration", "resolution", "video_codec", "audio_codec", "container",
		"needs_transcode", "direct_play_path", "tmdb_id", "tmdb_title", "tmdb_year",
		"import_status", "imported_vod_id", "imported_series_id", "error_message",
		"created_at", "updated_at",
	}
}

func sampleScanRow(id uint, sessionID string, now time.Time) []driver.Value {
	return []driver.Value{
		id, sessionID, "/lib/movie.mp4", "movie.mp4", int64(1024),
		"Movie Title", 2024, "movie", 0, 0,
		120.0, "1080p", "h264", "aac", "mp4",
		false, "/lib/movie.mp4", 0, "", 0,
		"pending", nil, nil, "",
		now, now,
	}
}

func TestLibraryScannerRepository_New(t *testing.T) {
	db, _, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLibraryScannerRepository(db)
	if repo == nil {
		t.Fatal("NewLibraryScannerRepository returned nil")
	}
}

func TestLibraryScannerRepository_Create(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLibraryScannerRepository(db)

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "library_scan_items"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	item := &model.LibraryScanItem{
		ScanSessionID: "sess-1",
		FilePath:      "/lib/movie.mp4",
		FileName:      "movie.mp4",
		MediaType:     "movie",
		ImportStatus:  "pending",
	}
	err := repo.Create(item)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLibraryScannerRepository_CreateBatch_Empty(t *testing.T) {
	db, _, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLibraryScannerRepository(db)

	err := repo.CreateBatch([]model.LibraryScanItem{})
	if err != nil {
		t.Fatalf("empty batch should not error: %v", err)
	}
}

func TestLibraryScannerRepository_CreateBatch(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLibraryScannerRepository(db)

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "library_scan_items"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1).AddRow(2))
	mock.ExpectCommit()

	items := []model.LibraryScanItem{
		{ScanSessionID: "sess-1", FilePath: "/a.mp4", FileName: "a.mp4", ImportStatus: "pending"},
		{ScanSessionID: "sess-1", FilePath: "/b.mp4", FileName: "b.mp4", ImportStatus: "pending"},
	}
	err := repo.CreateBatch(items)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLibraryScannerRepository_FindByID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLibraryScannerRepository(db)

	now := time.Now()
	mock.ExpectQuery(`SELECT \* FROM "library_scan_items" WHERE "library_scan_items"\."id" = \$1`).
		WithArgs(1, 1).
		WillReturnRows(sqlmock.NewRows(libraryScanColumns()).AddRow(sampleScanRow(1, "sess-1", now)...))

	item, err := repo.FindByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if item.FileName != "movie.mp4" {
		t.Errorf("expected FileName 'movie.mp4', got %q", item.FileName)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLibraryScannerRepository_FindBySessionID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLibraryScannerRepository(db)

	now := time.Now()
	mock.ExpectQuery(`SELECT count\(\*\) FROM "library_scan_items" WHERE scan_session_id`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(`SELECT \* FROM "library_scan_items" WHERE scan_session_id`).
		WillReturnRows(sqlmock.NewRows(libraryScanColumns()).AddRow(sampleScanRow(1, "sess-1", now)...))

	items, total, err := repo.FindBySessionID("sess-1", 1, 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(items) != 1 {
		t.Errorf("expected 1 item, got %d", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLibraryScannerRepository_FindPendingBySessionID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLibraryScannerRepository(db)

	now := time.Now()
	mock.ExpectQuery(`SELECT \* FROM "library_scan_items" WHERE scan_session_id .* AND import_status`).
		WillReturnRows(sqlmock.NewRows(libraryScanColumns()).AddRow(sampleScanRow(1, "sess-1", now)...))

	items, err := repo.FindPendingBySessionID("sess-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 1 {
		t.Errorf("expected 1 pending item, got %d", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLibraryScannerRepository_FindByIDs(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLibraryScannerRepository(db)

	now := time.Now()
	mock.ExpectQuery(`SELECT \* FROM "library_scan_items" WHERE id IN`).
		WithArgs(uint(1), uint(2)).
		WillReturnRows(sqlmock.NewRows(libraryScanColumns()).
			AddRow(sampleScanRow(1, "sess-1", now)...).
			AddRow(sampleScanRow(2, "sess-1", now)...))

	items, err := repo.FindByIDs([]uint{1, 2})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 2 {
		t.Errorf("expected 2 items, got %d", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLibraryScannerRepository_Update(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLibraryScannerRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "library_scan_items" SET`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	item := &model.LibraryScanItem{FileName: "updated.mp4", ImportStatus: "pending"}
	item.ID = 1
	err := repo.Update(item)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLibraryScannerRepository_UpdateImportStatus(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLibraryScannerRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "library_scan_items" SET`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	vodID := uint(5)
	err := repo.UpdateImportStatus(1, "imported", &vodID, nil, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLibraryScannerRepository_UpdateImportStatus_WithSeriesAndError(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLibraryScannerRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "library_scan_items" SET`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	seriesID := uint(10)
	err := repo.UpdateImportStatus(1, "error", nil, &seriesID, "import failed")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLibraryScannerRepository_DeleteBySessionID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLibraryScannerRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "library_scan_items" WHERE scan_session_id = \$1`).
		WithArgs("sess-1").
		WillReturnResult(sqlmock.NewResult(0, 3))
	mock.ExpectCommit()

	err := repo.DeleteBySessionID("sess-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLibraryScannerRepository_ExistsFilePath(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLibraryScannerRepository(db)

	mock.ExpectQuery(`SELECT count\(\*\) FROM "library_scan_items" WHERE file_path .* AND import_status`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	exists, err := repo.ExistsFilePath("/lib/movie.mp4")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !exists {
		t.Error("expected file path to exist")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLibraryScannerRepository_ExistsFilePath_NotFound(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLibraryScannerRepository(db)

	mock.ExpectQuery(`SELECT count\(\*\) FROM "library_scan_items" WHERE file_path .* AND import_status`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	exists, err := repo.ExistsFilePath("/lib/missing.mp4")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if exists {
		t.Error("expected file path to not exist")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLibraryScannerRepository_CountBySessionID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLibraryScannerRepository(db)

	mock.ExpectQuery(`SELECT count\(\*\) FROM "library_scan_items" WHERE scan_session_id = \$1`).
		WithArgs("sess-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(5))

	count, err := repo.CountBySessionID("sess-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 5 {
		t.Errorf("expected count 5, got %d", count)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

// Test applyFTSSearch (covers channel.go lines 13-18)
func TestApplyFTSSearch_ShortQuery(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()

	// Short query (< 3 chars) should use ILIKE only
	mock.ExpectQuery(`SELECT \* FROM "channels" WHERE name ILIKE`).
		WithArgs("%ab%").
		WillReturnRows(sqlmock.NewRows(channelColumns()))

	result := applyFTSSearch(db.Model(&model.Channel{}), "ab", "name")
	var channels []model.Channel
	result.Find(&channels)

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestApplyFTSSearch_LongQuery(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()

	// Long query (>= 3 chars) should use FTS + ILIKE
	mock.ExpectQuery(`SELECT \* FROM "channels" WHERE \(search_vector @@ plainto_tsquery`).
		WithArgs("sports", "%sports%").
		WillReturnRows(sqlmock.NewRows(channelColumns()))

	result := applyFTSSearch(db.Model(&model.Channel{}), "sports", "name")
	var channels []model.Channel
	result.Find(&channels)

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

// Test channel ListActive (covers lines 73-99)
func TestChannelRepository_ListActive(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewChannelRepository(db)

	now := time.Now()
	mock.ExpectQuery(`SELECT count\(\*\) FROM "channels" WHERE is_active`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(`SELECT \* FROM "channels" WHERE is_active`).
		WillReturnRows(sqlmock.NewRows(channelColumns()).
			AddRow(1, "ESPN", "espn", 1, "", "", nil, true, "", now, now, nil))
	mock.ExpectQuery(`SELECT \* FROM "categories"`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "slug", "type", "created_at", "updated_at", "deleted_at"}))

	channels, total, err := repo.ListActive(1, 10, "", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(channels) != 1 {
		t.Errorf("expected 1 channel, got %d", len(channels))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestChannelRepository_ListActive_WithSearch(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewChannelRepository(db)

	now := time.Now()
	mock.ExpectQuery(`SELECT count\(\*\) FROM "channels" WHERE is_active .* AND \(search_vector`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(`SELECT \* FROM "channels" WHERE is_active .* AND \(search_vector`).
		WillReturnRows(sqlmock.NewRows(channelColumns()).
			AddRow(1, "ESPN Sports", "espn-sports", 1, "", "", nil, true, "", now, now, nil))
	mock.ExpectQuery(`SELECT \* FROM "categories"`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "slug", "type", "created_at", "updated_at", "deleted_at"}))

	channels, total, err := repo.ListActive(1, 10, "sports", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(channels) != 1 {
		t.Errorf("expected 1 channel, got %d", len(channels))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestChannelRepository_ListActive_WithCategory(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewChannelRepository(db)

	now := time.Now()
	catID := uint(5)
	mock.ExpectQuery(`SELECT count\(\*\) FROM "channels" WHERE is_active .* AND category_id`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(`SELECT \* FROM "channels" WHERE is_active .* AND category_id`).
		WillReturnRows(sqlmock.NewRows(channelColumns()).
			AddRow(1, "ESPN", "espn", 5, "", "", nil, true, "", now, now, nil))
	mock.ExpectQuery(`SELECT \* FROM "categories"`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "slug", "type", "created_at", "updated_at", "deleted_at"}))

	channels, total, err := repo.ListActive(1, 10, "", &catID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(channels) != 1 {
		t.Errorf("expected 1 channel, got %d", len(channels))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

package repository

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/tivify/backend/internal/model"
)

func localMediaColumns() []string {
	return []string{"id", "original_filename", "file_path", "hls_path", "file_size", "duration", "resolution", "mime_type", "status", "progress", "error_message", "thumbnail_path", "created_at", "updated_at"}
}

func TestLocalMediaRepository_New(t *testing.T) {
	db, _, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLocalMediaRepository(db)
	if repo == nil {
		t.Fatal("NewLocalMediaRepository returned nil")
	}
}

func TestLocalMediaRepository_Create(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLocalMediaRepository(db)

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "local_media"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	media := &model.LocalMedia{
		OriginalFilename: "test.mp4",
		FilePath:         "/media/test.mp4",
		FileSize:         1024,
		MimeType:         "video/mp4",
		Status:           "pending",
	}
	err := repo.Create(media)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLocalMediaRepository_FindByID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLocalMediaRepository(db)

	now := time.Now()
	mock.ExpectQuery(`SELECT \* FROM "local_media" WHERE "local_media"\."id" = \$1`).
		WithArgs(1, 1).
		WillReturnRows(sqlmock.NewRows(localMediaColumns()).
			AddRow(1, "test.mp4", "/media/test.mp4", "/hls/1", int64(1024), 120.5, "1080p", "video/mp4", "ready", 100, "", "/thumb/1.jpg", now, now))

	media, err := repo.FindByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if media.OriginalFilename != "test.mp4" {
		t.Errorf("expected OriginalFilename 'test.mp4', got %q", media.OriginalFilename)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLocalMediaRepository_FindByID_NotFound(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLocalMediaRepository(db)

	mock.ExpectQuery(`SELECT \* FROM "local_media" WHERE "local_media"\."id" = \$1`).
		WithArgs(999, 1).
		WillReturnRows(sqlmock.NewRows(localMediaColumns()))

	_, err := repo.FindByID(999)
	if err == nil {
		t.Error("expected error for nonexistent media")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLocalMediaRepository_List(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLocalMediaRepository(db)

	now := time.Now()
	mock.ExpectQuery(`SELECT count\(\*\) FROM "local_media"`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
	mock.ExpectQuery(`SELECT \* FROM "local_media" ORDER BY created_at DESC`).
		WillReturnRows(sqlmock.NewRows(localMediaColumns()).
			AddRow(1, "a.mp4", "/a.mp4", "", int64(100), 60.0, "720p", "video/mp4", "ready", 100, "", "", now, now).
			AddRow(2, "b.mp4", "/b.mp4", "", int64(200), 0.0, "", "video/mp4", "pending", 0, "", "", now, now))

	media, total, err := repo.List(1, 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 2 {
		t.Errorf("expected total 2, got %d", total)
	}
	if len(media) != 2 {
		t.Errorf("expected 2 items, got %d", len(media))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLocalMediaRepository_Update(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLocalMediaRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "local_media" SET`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	media := &model.LocalMedia{OriginalFilename: "updated.mp4"}
	media.ID = 1
	err := repo.Update(media)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLocalMediaRepository_UpdateStatus(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLocalMediaRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "local_media" SET`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.UpdateStatus(1, "processing", 50, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLocalMediaRepository_UpdateStatus_WithError(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLocalMediaRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "local_media" SET`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.UpdateStatus(1, "error", 0, "transcoding failed")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLocalMediaRepository_Delete(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLocalMediaRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "local_media" WHERE "local_media"\."id" = \$1`).
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

func TestLocalMediaRepository_FindPendingTranscodes(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLocalMediaRepository(db)

	now := time.Now()
	mock.ExpectQuery(`SELECT \* FROM "local_media" WHERE status IN`).
		WillReturnRows(sqlmock.NewRows(localMediaColumns()).
			AddRow(1, "a.mp4", "/a.mp4", "", int64(100), 0.0, "", "video/mp4", "pending", 0, "", "", now, now).
			AddRow(2, "b.mp4", "/b.mp4", "", int64(200), 0.0, "", "video/mp4", "processing", 50, "", "", now, now))

	media, err := repo.FindPendingTranscodes()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(media) != 2 {
		t.Errorf("expected 2 pending, got %d", len(media))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestLocalMediaRepository_ListRecent(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewLocalMediaRepository(db)

	now := time.Now()
	mock.ExpectQuery(`SELECT \* FROM "local_media" ORDER BY created_at DESC`).
		WillReturnRows(sqlmock.NewRows(localMediaColumns()).
			AddRow(1, "recent.mp4", "/r.mp4", "", int64(100), 60.0, "1080p", "video/mp4", "ready", 100, "", "", now, now))

	media, err := repo.ListRecent(5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(media) != 1 {
		t.Errorf("expected 1 item, got %d", len(media))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

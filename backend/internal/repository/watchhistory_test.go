package repository

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/model"
)

func watchHistoryColumns() []string {
	return []string{"id", "user_id", "content_type", "content_id", "progress", "duration", "watched_at", "created_at", "updated_at"}
}

func TestWatchHistoryRepository_ListByUser(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewWatchHistoryRepository(db)

	uid := uuid.New()
	now := time.Now()

	mock.ExpectQuery(`SELECT count\(\*\) FROM "watch_history" WHERE user_id = \$1`).
		WithArgs(uid).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

	mock.ExpectQuery(`SELECT \* FROM "watch_history" WHERE user_id = \$1`).
		WillReturnRows(sqlmock.NewRows(watchHistoryColumns()).
			AddRow(1, uid, "vod", 10, 300, 3600, now, now, now).
			AddRow(2, uid, "channel", 20, 0, 0, now, now, now))

	history, total, err := repo.ListByUser(uid, 1, 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 2 {
		t.Errorf("expected total 2, got %d", total)
	}
	if len(history) != 2 {
		t.Errorf("expected 2 entries, got %d", len(history))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestWatchHistoryRepository_Upsert_Insert(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewWatchHistoryRepository(db)

	uid := uuid.New()

	// First, the find query returns nothing (not found)
	mock.ExpectQuery(`SELECT \* FROM "watch_history" WHERE user_id = \$1 AND content_type = \$2 AND content_id = \$3`).
		WithArgs(uid, "vod", 10, 1).
		WillReturnRows(sqlmock.NewRows(watchHistoryColumns()))

	// Then insert
	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "watch_history"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	entry := &model.WatchHistory{
		UserID:      uid,
		ContentType: "vod",
		ContentID:   10,
		Progress:    120,
		Duration:    3600,
	}

	err := repo.Upsert(entry)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestWatchHistoryRepository_Upsert_Update(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewWatchHistoryRepository(db)

	uid := uuid.New()
	now := time.Now()

	// First, find returns an existing record
	mock.ExpectQuery(`SELECT \* FROM "watch_history" WHERE user_id = \$1 AND content_type = \$2 AND content_id = \$3`).
		WithArgs(uid, "vod", 10, 1).
		WillReturnRows(sqlmock.NewRows(watchHistoryColumns()).
			AddRow(1, uid, "vod", 10, 60, 3600, now, now, now))

	// Then update (Save)
	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "watch_history" SET`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	entry := &model.WatchHistory{
		UserID:      uid,
		ContentType: "vod",
		ContentID:   10,
		Progress:    300,
		Duration:    3600,
	}

	err := repo.Upsert(entry)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestWatchHistoryRepository_ListContinueWatching(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewWatchHistoryRepository(db)

	uid := uuid.New()
	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "watch_history" WHERE .*user_id.*content_type.*`).
		WillReturnRows(sqlmock.NewRows(watchHistoryColumns()).
			AddRow(1, uid, "vod", 10, 300, 3600, now, now, now))

	history, err := repo.ListContinueWatching(uid, 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(history) != 1 {
		t.Errorf("expected 1 entry, got %d", len(history))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestWatchHistoryRepository_Delete(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewWatchHistoryRepository(db)

	uid := uuid.New()

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "watch_history" WHERE id = \$1 AND user_id = \$2`).
		WithArgs(1, uid).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.Delete(1, uid)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

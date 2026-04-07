package repository

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/tivify/backend/internal/model"
)

func streamColumns() []string {
	return []string{"id", "channel_id", "url", "stream_format", "priority", "is_active", "user_agent", "headers", "created_at", "updated_at"}
}

func TestStreamRepository_FindByID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewStreamRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "streams" WHERE "streams"\."id" = \$1`).
		WithArgs(1, 1).
		WillReturnRows(sqlmock.NewRows(streamColumns()).
			AddRow(1, 10, "http://stream.m3u8", "hls", 1, true, "", "{}", now, now))

	stream, err := repo.FindByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if stream.ID != 1 {
		t.Errorf("expected id 1, got %d", stream.ID)
	}
	if stream.URL != "http://stream.m3u8" {
		t.Errorf("expected url 'http://stream.m3u8', got %q", stream.URL)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestStreamRepository_FindByID_NotFound(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewStreamRepository(db)

	mock.ExpectQuery(`SELECT \* FROM "streams" WHERE "streams"\."id" = \$1`).
		WithArgs(999, 1).
		WillReturnRows(sqlmock.NewRows(streamColumns()))

	_, err := repo.FindByID(999)
	if err == nil {
		t.Error("expected error for nonexistent stream")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestStreamRepository_ListByChannel(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewStreamRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "streams" WHERE channel_id = \$1`).
		WithArgs(10).
		WillReturnRows(sqlmock.NewRows(streamColumns()).
			AddRow(1, 10, "http://a.m3u8", "hls", 2, true, "", "{}", now, now).
			AddRow(2, 10, "http://b.m3u8", "hls", 1, true, "", "{}", now, now))

	streams, err := repo.ListByChannel(10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(streams) != 2 {
		t.Errorf("expected 2 streams, got %d", len(streams))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestStreamRepository_Create(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewStreamRepository(db)

	stream := &model.Stream{
		ChannelID:    10,
		URL:          "http://new.m3u8",
		StreamFormat: "hls",
		Priority:     1,
		IsActive:     true,
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "streams"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	err := repo.Create(stream)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestStreamRepository_Update(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewStreamRepository(db)

	now := time.Now()
	stream := &model.Stream{
		ID:           1,
		ChannelID:    10,
		URL:          "http://updated.m3u8",
		StreamFormat: "hls",
		Priority:     2,
		IsActive:     true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "streams" SET`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Update(stream)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestStreamRepository_Delete(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewStreamRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "streams" WHERE "streams"\."id" = \$1`).
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

func TestStreamRepository_DeleteByChannel(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewStreamRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "streams" WHERE channel_id = \$1`).
		WithArgs(10).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectCommit()

	err := repo.DeleteByChannel(10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

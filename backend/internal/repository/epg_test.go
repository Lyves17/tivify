package repository

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/tivify/backend/internal/model"
)

func epgColumns() []string {
	return []string{"id", "channel_id", "title", "description", "start_time", "end_time", "category", "language", "episode_num", "created_at", "updated_at"}
}

func TestEPGRepository_FindByID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewEPGRepository(db)

	now := time.Now()
	start := now
	end := now.Add(1 * time.Hour)

	mock.ExpectQuery(`SELECT \* FROM "epg_entries" WHERE "epg_entries"\."id" = \$1`).
		WithArgs(1, 1).
		WillReturnRows(sqlmock.NewRows(epgColumns()).
			AddRow(1, 10, "News", "Daily news", start, end, "news", "es", "", now, now))

	mock.ExpectQuery(`SELECT \* FROM "channels" WHERE "channels"\."id" = \$1`).
		WithArgs(10).
		WillReturnRows(sqlmock.NewRows(channelColumns()).
			AddRow(10, "TV1", "tv1", nil, "", "", nil, true, "", now, now, nil))

	entry, err := repo.FindByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if entry.Title != "News" {
		t.Errorf("expected title 'News', got %q", entry.Title)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestEPGRepository_FindByID_NotFound(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewEPGRepository(db)

	mock.ExpectQuery(`SELECT \* FROM "epg_entries" WHERE "epg_entries"\."id" = \$1`).
		WithArgs(999, 1).
		WillReturnRows(sqlmock.NewRows(epgColumns()))

	_, err := repo.FindByID(999)
	if err == nil {
		t.Error("expected error for nonexistent epg entry")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestEPGRepository_List(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewEPGRepository(db)

	now := time.Now()
	start := now
	end := now.Add(1 * time.Hour)

	mock.ExpectQuery(`SELECT count\(\*\) FROM "epg_entries"`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	mock.ExpectQuery(`SELECT \* FROM "epg_entries"`).
		WillReturnRows(sqlmock.NewRows(epgColumns()).
			AddRow(1, 10, "Program", "Description", start, end, "entertainment", "es", "", now, now))

	mock.ExpectQuery(`SELECT \* FROM "channels" WHERE "channels"\."id" = \$1`).
		WithArgs(10).
		WillReturnRows(sqlmock.NewRows(channelColumns()).
			AddRow(10, "TV1", "tv1", nil, "", "", nil, true, "", now, now, nil))

	entries, total, err := repo.List(1, 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(entries) != 1 {
		t.Errorf("expected 1 entry, got %d", len(entries))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestEPGRepository_ListByChannel(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewEPGRepository(db)

	now := time.Now()
	date := time.Date(2024, 6, 15, 12, 0, 0, 0, time.UTC)
	startOfDay := time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC)
	endOfDay := startOfDay.Add(24 * time.Hour)

	start := time.Date(2024, 6, 15, 10, 0, 0, 0, time.UTC)
	end := time.Date(2024, 6, 15, 11, 0, 0, 0, time.UTC)

	mock.ExpectQuery(`SELECT \* FROM "epg_entries" WHERE channel_id = \$1 AND start_time >= \$2 AND start_time < \$3`).
		WithArgs(10, startOfDay, endOfDay).
		WillReturnRows(sqlmock.NewRows(epgColumns()).
			AddRow(1, 10, "Morning Show", "Morning show desc", start, end, "talk", "es", "", now, now))

	entries, err := repo.ListByChannel(10, date)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(entries) != 1 {
		t.Errorf("expected 1 entry, got %d", len(entries))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestEPGRepository_Create(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewEPGRepository(db)

	now := time.Now()
	entry := &model.EPGEntry{
		ChannelID:   10,
		Title:       "New Program",
		Description: "A new program",
		StartTime:   now,
		EndTime:     now.Add(1 * time.Hour),
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "epg_entries"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	err := repo.Create(entry)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestEPGRepository_Update(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewEPGRepository(db)

	now := time.Now()
	entry := &model.EPGEntry{
		ID:          1,
		ChannelID:   10,
		Title:       "Updated Program",
		Description: "Updated",
		StartTime:   now,
		EndTime:     now.Add(1 * time.Hour),
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "epg_entries" SET`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Update(entry)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestEPGRepository_Delete(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewEPGRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "epg_entries" WHERE "epg_entries"\."id" = \$1`).
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

func TestEPGRepository_Count(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewEPGRepository(db)

	mock.ExpectQuery(`SELECT count\(\*\) FROM "epg_entries"`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(100))

	count, err := repo.Count()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 100 {
		t.Errorf("expected count 100, got %d", count)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

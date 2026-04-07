package repository

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/tivify/backend/internal/model"
)

func emissionColumns() []string {
	return []string{"id", "channel_id", "status", "p_id", "error", "started_at", "created_at", "updated_at"}
}

func TestEmissionRepository_FindByChannelID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewEmissionRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "emissions" WHERE channel_id = \$1`).
		WithArgs(10, 1).
		WillReturnRows(sqlmock.NewRows(emissionColumns()).
			AddRow(1, 10, "running", 12345, "", &now, now, now))

	emission, err := repo.FindByChannelID(10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if emission.ChannelID != 10 {
		t.Errorf("expected channel_id 10, got %d", emission.ChannelID)
	}
	if emission.Status != "running" {
		t.Errorf("expected status 'running', got %q", emission.Status)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestEmissionRepository_FindByChannelID_NotFound(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewEmissionRepository(db)

	mock.ExpectQuery(`SELECT \* FROM "emissions" WHERE channel_id = \$1`).
		WithArgs(999, 1).
		WillReturnRows(sqlmock.NewRows(emissionColumns()))

	_, err := repo.FindByChannelID(999)
	if err == nil {
		t.Error("expected error for nonexistent emission")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestEmissionRepository_FindAllRunning(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewEmissionRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "emissions" WHERE status IN \(\$1,\$2\)`).
		WithArgs("running", "starting").
		WillReturnRows(sqlmock.NewRows(emissionColumns()).
			AddRow(1, 10, "running", 12345, "", &now, now, now).
			AddRow(2, 20, "starting", 0, "", nil, now, now))

	emissions, err := repo.FindAllRunning()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(emissions) != 2 {
		t.Errorf("expected 2 emissions, got %d", len(emissions))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestEmissionRepository_Create(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewEmissionRepository(db)

	emission := &model.Emission{
		ChannelID: 10,
		Status:    "starting",
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "emissions"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	err := repo.Create(emission)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestEmissionRepository_Save(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewEmissionRepository(db)

	now := time.Now()
	emission := &model.Emission{
		ID:        1,
		ChannelID: 10,
		Status:    "running",
		PID:       12345,
		StartedAt: &now,
		CreatedAt: now,
		UpdatedAt: now,
	}

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "emissions" SET`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Save(emission)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestEmissionRepository_UpdateStatus(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewEmissionRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "emissions" SET`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.UpdateStatus(10, "error", 0, "connection failed")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestEmissionRepository_ListAll(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewEmissionRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "emissions"`).
		WillReturnRows(sqlmock.NewRows(emissionColumns()).
			AddRow(1, 10, "running", 12345, "", &now, now, now))

	mock.ExpectQuery(`SELECT \* FROM "channels" WHERE "channels"\."id" = \$1`).
		WithArgs(10).
		WillReturnRows(sqlmock.NewRows(channelColumns()).
			AddRow(10, "TV1", "tv1", nil, "", "", nil, true, "", now, now, nil))

	emissions, err := repo.ListAll()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(emissions) != 1 {
		t.Errorf("expected 1 emission, got %d", len(emissions))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

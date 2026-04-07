package repository

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/model"
)

func sessionColumns() []string {
	return []string{"id", "user_id", "refresh_token", "user_agent", "ip_address", "expires_at", "created_at"}
}

func TestSessionRepository_Create(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSessionRepository(db)

	session := &model.Session{
		ID:           uuid.New(),
		UserID:       uuid.New(),
		RefreshToken: "test-refresh-token",
		UserAgent:    "TestBrowser/1.0",
		IPAddress:    "127.0.0.1",
		ExpiresAt:    time.Now().Add(24 * time.Hour),
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "sessions"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(session.ID))
	mock.ExpectCommit()

	err := repo.Create(session)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSessionRepository_FindByRefreshToken(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSessionRepository(db)

	sid := uuid.New()
	uid := uuid.New()
	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "sessions" WHERE refresh_token = \$1`).
		WithArgs("valid-token", 1).
		WillReturnRows(sqlmock.NewRows(sessionColumns()).
			AddRow(sid, uid, "valid-token", "Browser/1.0", "1.2.3.4", now.Add(24*time.Hour), now))

	session, err := repo.FindByRefreshToken("valid-token")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if session.RefreshToken != "valid-token" {
		t.Errorf("expected token 'valid-token', got %q", session.RefreshToken)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSessionRepository_FindByRefreshToken_NotFound(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSessionRepository(db)

	mock.ExpectQuery(`SELECT \* FROM "sessions" WHERE refresh_token = \$1`).
		WithArgs("invalid-token", 1).
		WillReturnRows(sqlmock.NewRows(sessionColumns()))

	_, err := repo.FindByRefreshToken("invalid-token")
	if err == nil {
		t.Error("expected error for nonexistent token")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSessionRepository_DeleteByID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSessionRepository(db)

	sid := uuid.New()

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "sessions" WHERE id = \$1`).
		WithArgs(sid).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.DeleteByID(sid)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSessionRepository_DeleteByUserID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSessionRepository(db)

	uid := uuid.New()

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "sessions" WHERE user_id = \$1`).
		WithArgs(uid).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectCommit()

	err := repo.DeleteByUserID(uid)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSessionRepository_DeleteExpired(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSessionRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "sessions" WHERE expires_at < NOW\(\)`).
		WillReturnResult(sqlmock.NewResult(0, 5))
	mock.ExpectCommit()

	err := repo.DeleteExpired()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSessionRepository_DeleteOldestByUser(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSessionRepository(db)

	uid := uuid.New()
	sid := uuid.New()
	now := time.Now()

	// First find oldest
	mock.ExpectQuery(`SELECT \* FROM "sessions" WHERE user_id = \$1 AND expires_at > NOW\(\)`).
		WithArgs(uid, 1).
		WillReturnRows(sqlmock.NewRows(sessionColumns()).
			AddRow(sid, uid, "oldest-token", "Browser", "1.2.3.4", now.Add(time.Hour), now))

	// Then delete it
	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "sessions" WHERE id = \$1`).
		WithArgs(sid).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.DeleteOldestByUser(uid)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSessionRepository_CountActiveByUser(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewSessionRepository(db)

	uid := uuid.New()

	mock.ExpectQuery(`SELECT count\(\*\) FROM "sessions" WHERE user_id = \$1 AND expires_at > NOW\(\)`).
		WithArgs(uid).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))

	count, err := repo.CountActiveByUser(uid)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 3 {
		t.Errorf("expected count 3, got %d", count)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

package repository

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/model"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupMockDB(t *testing.T) (*gorm.DB, sqlmock.Sqlmock, func()) {
	t.Helper()
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	gormDB, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("failed to open gorm db: %v", err)
	}
	return gormDB, mock, func() { sqlDB.Close() }
}

func userColumns() []string {
	return []string{"id", "username", "email", "password_hash", "role", "is_active", "max_connections", "exp_date", "created_at", "updated_at", "deleted_at"}
}

func TestUserRepository_FindByUsername(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewUserRepository(db)

	uid := uuid.New()
	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "users" WHERE username = \$1`).
		WithArgs("admin", 1).
		WillReturnRows(sqlmock.NewRows(userColumns()).
			AddRow(uid, "admin", "admin@test.com", "hash", "admin", true, 5, nil, now, now, nil))

	user, err := repo.FindByUsername("admin")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if user.Username != "admin" {
		t.Errorf("expected username 'admin', got %q", user.Username)
	}
	if user.ID != uid {
		t.Errorf("expected id %v, got %v", uid, user.ID)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestUserRepository_FindByUsername_NotFound(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewUserRepository(db)

	mock.ExpectQuery(`SELECT \* FROM "users" WHERE username = \$1`).
		WithArgs("nonexistent", 1).
		WillReturnRows(sqlmock.NewRows(userColumns()))

	_, err := repo.FindByUsername("nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent user")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestUserRepository_FindByID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewUserRepository(db)

	uid := uuid.New()
	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "users" WHERE id = \$1`).
		WithArgs(uid, 1).
		WillReturnRows(sqlmock.NewRows(userColumns()).
			AddRow(uid, "testuser", "test@test.com", "hash", "user", true, 1, nil, now, now, nil))

	user, err := repo.FindByID(uid)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if user.ID != uid {
		t.Errorf("expected id %v, got %v", uid, user.ID)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestUserRepository_Create(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewUserRepository(db)

	uid := uuid.New()
	user := &model.User{
		ID:             uid,
		Username:       "newuser",
		Email:          "new@test.com",
		PasswordHash:   "hash123",
		Role:           "user",
		IsActive:       true,
		MaxConnections: 1,
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "users"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(uid))
	mock.ExpectCommit()

	err := repo.Create(user)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestUserRepository_Count(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewUserRepository(db)

	mock.ExpectQuery(`SELECT count\(\*\) FROM "users"`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(42))

	count, err := repo.Count()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 42 {
		t.Errorf("expected count 42, got %d", count)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestUserRepository_Delete(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewUserRepository(db)

	uid := uuid.New()

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "users" SET "deleted_at"=\$1 WHERE id = \$2`).
		WithArgs(sqlmock.AnyArg(), uid).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.Delete(uid)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestUserRepository_FindByEmail(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewUserRepository(db)

	uid := uuid.New()
	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "users" WHERE email = \$1`).
		WithArgs("test@example.com", 1).
		WillReturnRows(sqlmock.NewRows(userColumns()).
			AddRow(uid, "testuser", "test@example.com", "hash", "user", true, 1, nil, now, now, nil))

	user, err := repo.FindByEmail("test@example.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if user.Email != "test@example.com" {
		t.Errorf("expected email 'test@example.com', got %q", user.Email)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestUserRepository_Update(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewUserRepository(db)

	uid := uuid.New()
	now := time.Now()
	user := &model.User{
		ID:             uid,
		Username:       "updateduser",
		Email:          "updated@test.com",
		PasswordHash:   "newhash",
		Role:           "admin",
		IsActive:       true,
		MaxConnections: 2,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "users" SET`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.Update(user)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestUserRepository_ListRecent(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewUserRepository(db)

	uid := uuid.New()
	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "users"`).
		WillReturnRows(sqlmock.NewRows(userColumns()).
			AddRow(uid, "recent1", "recent@test.com", "hash", "user", true, 1, nil, now, now, nil))

	users, err := repo.ListRecent(5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(users) != 1 {
		t.Errorf("expected 1 user, got %d", len(users))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestUserRepository_FindByEmail_NotFound(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewUserRepository(db)

	mock.ExpectQuery(`SELECT \* FROM "users" WHERE email = \$1`).
		WithArgs("notfound@test.com", 1).
		WillReturnRows(sqlmock.NewRows(userColumns()))

	_, err := repo.FindByEmail("notfound@test.com")
	if err == nil {
		t.Error("expected error for nonexistent email")
	}
}

func TestUserRepository_FindByID_NotFound(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewUserRepository(db)

	uid := uuid.New()
	mock.ExpectQuery(`SELECT \* FROM "users" WHERE "users"\."id" = \$1`).
		WithArgs(uid, 1).
		WillReturnRows(sqlmock.NewRows(userColumns()))

	_, err := repo.FindByID(uid)
	if err == nil {
		t.Error("expected error for nonexistent user ID")
	}
}

func TestUserRepository_List(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewUserRepository(db)

	uid := uuid.New()
	now := time.Now()

	// Count query
	mock.ExpectQuery(`SELECT count\(\*\) FROM "users"`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	// List query
	mock.ExpectQuery(`SELECT \* FROM "users"`).
		WillReturnRows(sqlmock.NewRows(userColumns()).
			AddRow(uid, "user1", "user1@test.com", "hash", "user", true, 1, nil, now, now, nil))

	users, total, err := repo.List(1, 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 1 {
		t.Errorf("expected total 1, got %d", total)
	}
	if len(users) != 1 {
		t.Errorf("expected 1 user, got %d", len(users))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

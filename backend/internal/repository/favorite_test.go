package repository

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/model"
)

func favoriteColumns() []string {
	return []string{"id", "user_id", "favoritable_type", "favoritable_id", "created_at"}
}

func TestFavoriteRepository_FindByUserAndItem(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewFavoriteRepository(db)

	uid := uuid.New()
	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "favorites" WHERE user_id = \$1 AND favoritable_type = \$2 AND favoritable_id = \$3`).
		WithArgs(uid, "channel", 10, 1).
		WillReturnRows(sqlmock.NewRows(favoriteColumns()).
			AddRow(1, uid, "channel", 10, now))

	fav, err := repo.FindByUserAndItem(uid, "channel", 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if fav.UserID != uid {
		t.Errorf("expected user_id %v, got %v", uid, fav.UserID)
	}
	if fav.FavoritableType != "channel" {
		t.Errorf("expected type 'channel', got %q", fav.FavoritableType)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestFavoriteRepository_FindByUserAndItem_NotFound(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewFavoriteRepository(db)

	uid := uuid.New()

	mock.ExpectQuery(`SELECT \* FROM "favorites" WHERE user_id = \$1 AND favoritable_type = \$2 AND favoritable_id = \$3`).
		WithArgs(uid, "vod", 999, 1).
		WillReturnRows(sqlmock.NewRows(favoriteColumns()))

	_, err := repo.FindByUserAndItem(uid, "vod", 999)
	if err == nil {
		t.Error("expected error for nonexistent favorite")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestFavoriteRepository_ListByUser(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewFavoriteRepository(db)

	uid := uuid.New()
	now := time.Now()

	mock.ExpectQuery(`SELECT count\(\*\) FROM "favorites" WHERE user_id = \$1`).
		WithArgs(uid).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

	mock.ExpectQuery(`SELECT \* FROM "favorites" WHERE user_id = \$1`).
		WillReturnRows(sqlmock.NewRows(favoriteColumns()).
			AddRow(1, uid, "channel", 10, now).
			AddRow(2, uid, "vod", 20, now))

	favs, total, err := repo.ListByUser(uid, 1, 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 2 {
		t.Errorf("expected total 2, got %d", total)
	}
	if len(favs) != 2 {
		t.Errorf("expected 2 favorites, got %d", len(favs))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestFavoriteRepository_Create(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewFavoriteRepository(db)

	uid := uuid.New()
	fav := &model.Favorite{
		UserID:          uid,
		FavoritableType: "channel",
		FavoritableID:   10,
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "favorites"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	err := repo.Create(fav)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestFavoriteRepository_Delete(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewFavoriteRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "favorites" WHERE "favorites"\."id" = \$1`).
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

func TestFavoriteRepository_DeleteByUserAndItem(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewFavoriteRepository(db)

	uid := uuid.New()

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "favorites" WHERE user_id = \$1 AND favoritable_type = \$2 AND favoritable_id = \$3`).
		WithArgs(uid, "vod", 20).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.DeleteByUserAndItem(uid, "vod", 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

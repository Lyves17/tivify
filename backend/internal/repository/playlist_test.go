package repository

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/tivify/backend/internal/model"
)

func playlistColumns() []string {
	return []string{"id", "channel_id", "playback_mode", "is_active", "created_at", "updated_at"}
}

func playlistItemColumns() []string {
	return []string{"id", "playlist_id", "local_media_id", "sort_order", "created_at"}
}

func TestPlaylistRepository_FindByChannelID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewPlaylistRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "playlists" WHERE channel_id = \$1`).
		WithArgs(10, 1).
		WillReturnRows(sqlmock.NewRows(playlistColumns()).
			AddRow(1, 10, "loop", true, now, now))

	// Preload Items (ordered by sort_order)
	mock.ExpectQuery(`SELECT \* FROM "playlist_items" WHERE "playlist_items"\."playlist_id" = \$1`).
		WithArgs(1).
		WillReturnRows(sqlmock.NewRows(playlistItemColumns()).
			AddRow(1, 1, 100, 0, now).
			AddRow(2, 1, 200, 1, now))

	// Preload Items.LocalMedia
	mock.ExpectQuery(`SELECT \* FROM "local_media" WHERE "local_media"\."id" IN \(\$1,\$2\)`).
		WithArgs(100, 200).
		WillReturnRows(sqlmock.NewRows([]string{"id", "filename", "filepath", "file_size", "duration", "resolution", "created_at", "updated_at"}))

	playlist, err := repo.FindByChannelID(10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if playlist.ChannelID != 10 {
		t.Errorf("expected channel_id 10, got %d", playlist.ChannelID)
	}
	if playlist.PlaybackMode != "loop" {
		t.Errorf("expected playback_mode 'loop', got %q", playlist.PlaybackMode)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestPlaylistRepository_FindByChannelID_NotFound(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewPlaylistRepository(db)

	mock.ExpectQuery(`SELECT \* FROM "playlists" WHERE channel_id = \$1`).
		WithArgs(999, 1).
		WillReturnRows(sqlmock.NewRows(playlistColumns()))

	_, err := repo.FindByChannelID(999)
	if err == nil {
		t.Error("expected error for nonexistent playlist")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestPlaylistRepository_Create(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewPlaylistRepository(db)

	playlist := &model.Playlist{
		ChannelID:    10,
		PlaybackMode: "loop",
		IsActive:     true,
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "playlists"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	err := repo.Create(playlist)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestPlaylistRepository_Update(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewPlaylistRepository(db)

	now := time.Now()
	playlist := &model.Playlist{
		ID:           1,
		ChannelID:    10,
		PlaybackMode: "sequential",
		IsActive:     true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "playlists" SET`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Update(playlist)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestPlaylistRepository_AddItem(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewPlaylistRepository(db)

	item := &model.PlaylistItem{
		PlaylistID:   1,
		LocalMediaID: 100,
		SortOrder:    0,
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "playlist_items"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	err := repo.AddItem(item)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestPlaylistRepository_RemoveItem(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewPlaylistRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "playlist_items" WHERE "playlist_items"\."id" = \$1`).
		WithArgs(1).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.RemoveItem(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestPlaylistRepository_FindItemByID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewPlaylistRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "playlist_items" WHERE "playlist_items"\."id" = \$1`).
		WithArgs(1, 1).
		WillReturnRows(sqlmock.NewRows(playlistItemColumns()).
			AddRow(1, 1, 100, 0, now))

	item, err := repo.FindItemByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if item.ID != 1 {
		t.Errorf("expected id 1, got %d", item.ID)
	}
	if item.LocalMediaID != 100 {
		t.Errorf("expected local_media_id 100, got %d", item.LocalMediaID)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestPlaylistRepository_FindItemByID_NotFound(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewPlaylistRepository(db)

	mock.ExpectQuery(`SELECT \* FROM "playlist_items" WHERE "playlist_items"\."id" = \$1`).
		WithArgs(999, 1).
		WillReturnRows(sqlmock.NewRows(playlistItemColumns()))

	_, err := repo.FindItemByID(999)
	if err == nil {
		t.Error("expected error for nonexistent playlist item")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestPlaylistRepository_DeleteByChannelID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewPlaylistRepository(db)

	now := time.Now()

	// First find the playlist
	mock.ExpectQuery(`SELECT \* FROM "playlists" WHERE channel_id = \$1`).
		WithArgs(10, 1).
		WillReturnRows(sqlmock.NewRows(playlistColumns()).
			AddRow(1, 10, "loop", true, now, now))

	// Delete playlist items
	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "playlist_items" WHERE playlist_id = \$1`).
		WithArgs(1).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectCommit()

	// Delete the playlist itself
	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM "playlists" WHERE "playlists"\."id" = \$1`).
		WithArgs(1).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.DeleteByChannelID(10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestPlaylistRepository_DeleteByChannelID_NotFound(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewPlaylistRepository(db)

	mock.ExpectQuery(`SELECT \* FROM "playlists" WHERE channel_id = \$1`).
		WithArgs(999, 1).
		WillReturnRows(sqlmock.NewRows(playlistColumns()))

	err := repo.DeleteByChannelID(999)
	if err == nil {
		t.Error("expected error when playlist not found")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

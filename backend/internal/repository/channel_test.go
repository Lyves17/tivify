package repository

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/tivify/backend/internal/model"
)

func channelColumns() []string {
	return []string{"id", "name", "slug", "category_id", "logo_url", "epg_channel_id", "channel_number", "is_active", "source", "created_at", "updated_at", "deleted_at"}
}

func TestChannelRepository_FindByID(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewChannelRepository(db)

	now := time.Now()

	// Preload Category
	mock.ExpectQuery(`SELECT \* FROM "channels" WHERE "channels"\."id" = \$1`).
		WithArgs(1, 1).
		WillReturnRows(sqlmock.NewRows(channelColumns()).
			AddRow(1, "Channel 1", "channel-1", nil, "http://logo.png", "ch1", nil, true, "", now, now, nil))

	// Preload Streams
	mock.ExpectQuery(`SELECT \* FROM "streams".*`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "channel_id", "url", "stream_format", "priority", "is_active", "user_agent", "headers", "created_at", "updated_at"}))

	channel, err := repo.FindByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if channel.Name != "Channel 1" {
		t.Errorf("expected name 'Channel 1', got %q", channel.Name)
	}
	if channel.ID != 1 {
		t.Errorf("expected id 1, got %d", channel.ID)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestChannelRepository_FindByID_NotFound(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewChannelRepository(db)

	mock.ExpectQuery(`SELECT \* FROM "channels" WHERE "channels"\."id" = \$1`).
		WithArgs(999, 1).
		WillReturnRows(sqlmock.NewRows(channelColumns()))

	_, err := repo.FindByID(999)
	if err == nil {
		t.Error("expected error for nonexistent channel")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestChannelRepository_FindBySlug(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewChannelRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT \* FROM "channels" WHERE slug = \$1`).
		WithArgs("test-slug", 1).
		WillReturnRows(sqlmock.NewRows(channelColumns()).
			AddRow(1, "Test Channel", "test-slug", nil, "", "", nil, true, "", now, now, nil))

	mock.ExpectQuery(`SELECT \* FROM "streams".*`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "channel_id", "url", "stream_format", "priority", "is_active", "user_agent", "headers", "created_at", "updated_at"}))

	channel, err := repo.FindBySlug("test-slug")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if channel.Slug != "test-slug" {
		t.Errorf("expected slug 'test-slug', got %q", channel.Slug)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestChannelRepository_List(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewChannelRepository(db)

	now := time.Now()

	mock.ExpectQuery(`SELECT count\(\*\) FROM "channels".*`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	mock.ExpectQuery(`SELECT \* FROM "channels".*`).
		WillReturnRows(sqlmock.NewRows(channelColumns()).
			AddRow(1, "Ch1", "ch1", nil, "", "", nil, true, "", now, now, nil))

	mock.ExpectQuery(`SELECT \* FROM "streams".*`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "channel_id", "url", "stream_format", "priority", "is_active", "user_agent", "headers", "created_at", "updated_at"}))

	channels, total, err := repo.List(1, 20)
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

func TestChannelRepository_Create(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewChannelRepository(db)

	channel := &model.Channel{
		Name:     "New Channel",
		Slug:     "new-channel",
		IsActive: true,
		Source:   "iptv-org",
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "channels"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	err := repo.Create(channel)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestChannelRepository_Update(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewChannelRepository(db)

	now := time.Now()
	channel := &model.Channel{
		ID:        1,
		Name:      "Updated Channel",
		Slug:      "updated-channel",
		IsActive:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "channels" SET`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Update(channel)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestChannelRepository_Delete(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewChannelRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "channels" SET "deleted_at"=\$1 WHERE "channels"\."id" = \$2`).
		WithArgs(sqlmock.AnyArg(), 1).
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

func TestChannelRepository_Count(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewChannelRepository(db)

	mock.ExpectQuery(`SELECT count\(\*\) FROM "channels"`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(15))

	count, err := repo.Count()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 15 {
		t.Errorf("expected count 15, got %d", count)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestChannelRepository_CountActive(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewChannelRepository(db)

	mock.ExpectQuery(`SELECT count\(\*\) FROM "channels" WHERE is_active = \$1`).
		WithArgs(true).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(10))

	count, err := repo.CountActive()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 10 {
		t.Errorf("expected count 10, got %d", count)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestChannelRepository_CountBySource(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewChannelRepository(db)

	mock.ExpectQuery(`SELECT count\(\*\) FROM "channels" WHERE source = \$1`).
		WithArgs("iptv-org").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(5))

	count, err := repo.CountBySource("iptv-org")
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

func TestChannelRepository_DeleteBySource(t *testing.T) {
	db, mock, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewChannelRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "channels" SET "deleted_at"=\$1 WHERE source = \$2`).
		WithArgs(sqlmock.AnyArg(), "iptv-org").
		WillReturnResult(sqlmock.NewResult(0, 3))
	mock.ExpectCommit()

	err := repo.DeleteBySource("iptv-org")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSanitizeForSQL(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"hello", "hello"},
		{"it's", "it''s"},
		{"test''double", "test''''double"},
		{"", ""},
		{"no quotes here", "no quotes here"},
	}
	for _, tt := range tests {
		got := sanitizeForSQL(tt.input)
		if got != tt.want {
			t.Errorf("sanitizeForSQL(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestFTSOrderClause(t *testing.T) {
	result := ftsOrderClause("news", "name ASC")
	if result == "" {
		t.Error("ftsOrderClause should return non-empty string")
	}
	// Should contain the fallback order
	if !contains(result, "name ASC") {
		t.Errorf("ftsOrderClause should contain fallback, got: %s", result)
	}
}

func TestFTSOrderClause_SQLInjection(t *testing.T) {
	// Single quote should be escaped to double quotes
	result := ftsOrderClause("test'injection", "name ASC")
	// The single quote in "test'injection" should become "test''injection"
	if contains(result, "test'i") && !contains(result, "test''i") {
		t.Error("ftsOrderClause should escape single quotes")
	}
	// Should still contain the search term (escaped)
	if !contains(result, "test''injection") {
		t.Errorf("ftsOrderClause should contain escaped search, got: %s", result)
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && containsStr(s, sub))
}

func containsStr(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func TestChannelRepository_DeleteBySource_EmptyProtection(t *testing.T) {
	db, _, cleanup := setupMockDB(t)
	defer cleanup()
	repo := NewChannelRepository(db)

	// DeleteBySource with empty string should return nil without executing any query
	err := repo.DeleteBySource("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// No mock expectations set, so if any query ran it would fail
}

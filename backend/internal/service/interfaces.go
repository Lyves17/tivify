package service

import (
	"time"

	"github.com/google/uuid"
	"github.com/tivify/backend/internal/model"
)

// Repository interfaces for dependency injection and testability.
// AuthService already defines UserRepository and SessionRepository in auth.go.

// FullUserRepository extends UserRepository (defined in auth.go) with all user repo methods.
type FullUserRepository interface {
	UserRepository // FindByUsername, FindByID, Create
	FindByEmail(email string) (*model.User, error)
	Update(user *model.User) error
	Delete(id uuid.UUID) error
	List(page, perPage int) ([]model.User, int64, error)
	ListRecent(limit int) ([]model.User, error)
	Count() (int64, error)
}

// FullSessionRepository extends SessionRepository (defined in auth.go) with all session repo methods.
type FullSessionRepository interface {
	SessionRepository // Create, FindByRefreshToken, DeleteByID, CountActiveByUser, DeleteOldestByUser
	DeleteByUserID(userID uuid.UUID) error
	DeleteExpired() error
}

// ChannelRepositoryInterface defines the interface for channel data access.
type ChannelRepositoryInterface interface {
	FindByID(id uint) (*model.Channel, error)
	FindBySlug(slug string) (*model.Channel, error)
	List(page, perPage int) ([]model.Channel, int64, error)
	ListActive(page, perPage int, search string, categoryID *uint) ([]model.Channel, int64, error)
	Create(channel *model.Channel) error
	Update(channel *model.Channel) error
	Delete(id uint) error
	Count() (int64, error)
	CountActive() (int64, error)
	CountBySource(source string) (int64, error)
	DeleteBySource(source string) error
}

// StreamRepositoryInterface defines the interface for stream data access.
type StreamRepositoryInterface interface {
	FindByID(id uint) (*model.Stream, error)
	ListByChannel(channelID uint) ([]model.Stream, error)
	Create(stream *model.Stream) error
	Update(stream *model.Stream) error
	Delete(id uint) error
	DeleteByChannel(channelID uint) error
}

// CategoryRepositoryInterface defines the interface for category data access.
type CategoryRepositoryInterface interface {
	FindByID(id uint) (*model.Category, error)
	FindBySlug(slug string) (*model.Category, error)
	List(page, perPage int) ([]model.Category, int64, error)
	ListByType(categoryType string) ([]model.Category, error)
	Create(category *model.Category) error
	Update(category *model.Category) error
	Delete(id uint) error
	Count() (int64, error)
}

// VODRepositoryInterface defines the interface for VOD data access.
type VODRepositoryInterface interface {
	FindByID(id uint) (*model.VOD, error)
	FindBySlug(slug string) (*model.VOD, error)
	List(page, perPage int) ([]model.VOD, int64, error)
	ListActive(page, perPage int, search string, categoryID *uint) ([]model.VOD, int64, error)
	ListBySeries(seriesID uint) ([]model.VOD, error)
	Create(vod *model.VOD) error
	Update(vod *model.VOD) error
	Delete(id uint) error
	Count() (int64, error)
	CountActive() (int64, error)
	ListRecent(limit int) ([]model.VOD, error)
	ListByTranscodeStatus(statuses []string) ([]model.VOD, error)
	ListWithoutPoster() ([]model.VOD, error)
	DebugAll() ([]model.VOD, error)
}

// SeriesRepositoryInterface defines the interface for series data access.
type SeriesRepositoryInterface interface {
	FindByID(id uint) (*model.Series, error)
	FindBySlug(slug string) (*model.Series, error)
	List(page, perPage int) ([]model.Series, int64, error)
	ListActive(page, perPage int, search string, categoryID *uint) ([]model.Series, int64, error)
	Create(series *model.Series) error
	Update(series *model.Series) error
	Delete(id uint) error
	Count() (int64, error)
	CountActive() (int64, error)
	CountEpisodes(seriesID uint) (int64, error)
	ListWithoutPoster() ([]model.Series, error)
}

// FavoriteRepositoryInterface defines the interface for favorite data access.
type FavoriteRepositoryInterface interface {
	FindByUserAndItem(userID uuid.UUID, favType string, favID uint) (*model.Favorite, error)
	ListByUser(userID uuid.UUID, page, perPage int) ([]model.Favorite, int64, error)
	Create(fav *model.Favorite) error
	Delete(id uint) error
	DeleteByUserAndItem(userID uuid.UUID, favType string, favID uint) error
}

// WatchHistoryRepositoryInterface defines the interface for watch history data access.
type WatchHistoryRepositoryInterface interface {
	ListByUser(userID uuid.UUID, page, perPage int) ([]model.WatchHistory, int64, error)
	Upsert(entry *model.WatchHistory) error
	ListContinueWatching(userID uuid.UUID, limit int) ([]model.WatchHistory, error)
	Delete(id uint, userID uuid.UUID) error
}

// EPGRepositoryInterface defines the interface for EPG data access.
type EPGRepositoryInterface interface {
	FindByID(id uint) (*model.EPGEntry, error)
	List(page, perPage int) ([]model.EPGEntry, int64, error)
	ListByChannel(channelID uint, date time.Time) ([]model.EPGEntry, error)
	Create(entry *model.EPGEntry) error
	Update(entry *model.EPGEntry) error
	Delete(id uint) error
	Count() (int64, error)
}

// EmissionRepositoryInterface defines the interface for emission data access.
type EmissionRepositoryInterface interface {
	FindByChannelID(channelID uint) (*model.Emission, error)
	FindAllRunning() ([]model.Emission, error)
	Create(emission *model.Emission) error
	Save(emission *model.Emission) error
	UpdateStatus(channelID uint, status string, pid int, errMsg string) error
	ListAll() ([]model.Emission, error)
}

// LocalMediaRepositoryInterface defines the interface for local media data access.
type LocalMediaRepositoryInterface interface {
	Create(media *model.LocalMedia) error
	FindByID(id uint) (*model.LocalMedia, error)
	List(page, perPage int) ([]model.LocalMedia, int64, error)
	Update(media *model.LocalMedia) error
	UpdateStatus(id uint, status string, progress int, errorMsg string) error
	Delete(id uint) error
	FindPendingTranscodes() ([]model.LocalMedia, error)
	ListRecent(limit int) ([]model.LocalMedia, error)
}

// PlaylistRepositoryInterface defines the interface for playlist data access.
type PlaylistRepositoryInterface interface {
	FindByChannelID(channelID uint) (*model.Playlist, error)
	Create(playlist *model.Playlist) error
	Update(playlist *model.Playlist) error
	AddItem(item *model.PlaylistItem) error
	RemoveItem(itemID uint) error
	FindItemByID(itemID uint) (*model.PlaylistItem, error)
	ReorderItems(playlistID uint, items []struct {
		ID        uint
		SortOrder int
	}) error
	DeleteByChannelID(channelID uint) error
}

// LibraryScannerRepositoryInterface defines the interface for library scanner data access.
type LibraryScannerRepositoryInterface interface {
	Create(item *model.LibraryScanItem) error
	CreateBatch(items []model.LibraryScanItem) error
	FindByID(id uint) (*model.LibraryScanItem, error)
	FindBySessionID(sessionID string, page, perPage int) ([]model.LibraryScanItem, int64, error)
	FindPendingBySessionID(sessionID string) ([]model.LibraryScanItem, error)
	FindByIDs(ids []uint) ([]model.LibraryScanItem, error)
	Update(item *model.LibraryScanItem) error
	UpdateImportStatus(id uint, status string, vodID *uint, seriesID *uint, errMsg string) error
	DeleteBySessionID(sessionID string) error
	ExistsFilePath(filePath string) (bool, error)
	CountBySessionID(sessionID string) (int64, error)
}

// CacheServiceInterface defines the interface for cache operations.
type CacheServiceInterface interface {
	Get(key string, dest interface{}) bool
	Set(key string, value interface{}, ttl time.Duration) error
	Delete(key string) error
	DeletePrefix(prefix string) error
}

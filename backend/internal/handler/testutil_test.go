package handler

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/util"
	"gorm.io/gorm"
)

func init() {
	util.InitJWT("test-secret-key-at-least-32-chars!!", 15*time.Minute)
}

func testApp() *fiber.App {
	return fiber.New(fiber.Config{ErrorHandler: func(c *fiber.Ctx, err error) error {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}})
}

func makeRequest(app *fiber.App, method, path string, body string) (*util.APIResponse, int) {
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	var result util.APIResponse
	json.Unmarshal(data, &result)
	return &result, resp.StatusCode
}

func makeAuthRequest(app *fiber.App, method, path, body string, userID uuid.UUID, role string) (*util.APIResponse, int) {
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}

	// Middleware simulation: set user info in locals
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", userID)
		c.Locals("role", role)
		return c.Next()
	})

	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	var result util.APIResponse
	json.Unmarshal(data, &result)
	return &result, resp.StatusCode
}

// --- Mock Repos for service construction ---

// mockUserRepoForHandler implements service.FullUserRepository
type mockUserRepoForHandler struct {
	users   map[string]*model.User
	byID    map[uuid.UUID]*model.User
	byEmail map[string]*model.User
}

func newMockUserRepoH() *mockUserRepoForHandler {
	return &mockUserRepoForHandler{
		users:   make(map[string]*model.User),
		byID:    make(map[uuid.UUID]*model.User),
		byEmail: make(map[string]*model.User),
	}
}

func (m *mockUserRepoForHandler) FindByUsername(username string) (*model.User, error) {
	u, ok := m.users[username]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return u, nil
}
func (m *mockUserRepoForHandler) FindByID(id uuid.UUID) (*model.User, error) {
	u, ok := m.byID[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return u, nil
}
func (m *mockUserRepoForHandler) Create(user *model.User) error {
	m.users[user.Username] = user
	m.byID[user.ID] = user
	m.byEmail[user.Email] = user
	return nil
}
func (m *mockUserRepoForHandler) FindByEmail(email string) (*model.User, error) {
	u, ok := m.byEmail[email]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return u, nil
}
func (m *mockUserRepoForHandler) Update(user *model.User) error {
	m.users[user.Username] = user
	m.byID[user.ID] = user
	m.byEmail[user.Email] = user
	return nil
}
func (m *mockUserRepoForHandler) Delete(id uuid.UUID) error {
	u, ok := m.byID[id]
	if !ok {
		return gorm.ErrRecordNotFound
	}
	delete(m.users, u.Username)
	delete(m.byID, id)
	delete(m.byEmail, u.Email)
	return nil
}
func (m *mockUserRepoForHandler) List(page, perPage int) ([]model.User, int64, error) {
	var users []model.User
	for _, u := range m.byID {
		users = append(users, *u)
	}
	return users, int64(len(users)), nil
}
func (m *mockUserRepoForHandler) ListRecent(limit int) ([]model.User, error) {
	var users []model.User
	for _, u := range m.byID {
		users = append(users, *u)
	}
	return users, nil
}
func (m *mockUserRepoForHandler) Count() (int64, error) {
	return int64(len(m.byID)), nil
}
func (m *mockUserRepoForHandler) addUser(user *model.User) {
	m.users[user.Username] = user
	m.byID[user.ID] = user
	m.byEmail[user.Email] = user
}

// mockCategoryRepoH implements service.CategoryRepositoryInterface
type mockCategoryRepoH struct {
	categories map[uint]*model.Category
	bySlug     map[string]*model.Category
	nextID     uint
}

func newMockCategoryRepoH() *mockCategoryRepoH {
	return &mockCategoryRepoH{
		categories: make(map[uint]*model.Category),
		bySlug:     make(map[string]*model.Category),
		nextID:     1,
	}
}

func (m *mockCategoryRepoH) FindByID(id uint) (*model.Category, error) {
	c, ok := m.categories[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return c, nil
}
func (m *mockCategoryRepoH) FindBySlug(slug string) (*model.Category, error) {
	c, ok := m.bySlug[slug]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return c, nil
}
func (m *mockCategoryRepoH) List(page, perPage int) ([]model.Category, int64, error) {
	var cats []model.Category
	for _, c := range m.categories {
		cats = append(cats, *c)
	}
	return cats, int64(len(cats)), nil
}
func (m *mockCategoryRepoH) ListByType(categoryType string) ([]model.Category, error) {
	var cats []model.Category
	for _, c := range m.categories {
		if c.Type == categoryType {
			cats = append(cats, *c)
		}
	}
	return cats, nil
}
func (m *mockCategoryRepoH) Create(category *model.Category) error {
	category.ID = m.nextID
	m.nextID++
	m.categories[category.ID] = category
	m.bySlug[category.Slug] = category
	return nil
}
func (m *mockCategoryRepoH) Update(category *model.Category) error {
	m.categories[category.ID] = category
	return nil
}
func (m *mockCategoryRepoH) Delete(id uint) error {
	c, ok := m.categories[id]
	if !ok {
		return gorm.ErrRecordNotFound
	}
	delete(m.categories, id)
	delete(m.bySlug, c.Slug)
	return nil
}
func (m *mockCategoryRepoH) Count() (int64, error) {
	return int64(len(m.categories)), nil
}
func (m *mockCategoryRepoH) addCategory(cat *model.Category) {
	if cat.ID == 0 {
		cat.ID = m.nextID
		m.nextID++
	}
	m.categories[cat.ID] = cat
	m.bySlug[cat.Slug] = cat
}

// mockCacheH implements service.CacheServiceInterface
type mockCacheH struct{}

func (m *mockCacheH) Get(key string, dest interface{}) bool                      { return false }
func (m *mockCacheH) Set(key string, value interface{}, ttl time.Duration) error { return nil }
func (m *mockCacheH) Delete(key string) error                                    { return nil }
func (m *mockCacheH) DeletePrefix(prefix string) error                           { return nil }

// --- Channel & Stream mock repos ---

type mockChannelRepoH struct {
	channels map[uint]*model.Channel
	nextID   uint
}

func newMockChannelRepoH() *mockChannelRepoH {
	return &mockChannelRepoH{channels: make(map[uint]*model.Channel), nextID: 1}
}
func (m *mockChannelRepoH) FindByID(id uint) (*model.Channel, error) {
	c, ok := m.channels[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return c, nil
}
func (m *mockChannelRepoH) FindBySlug(slug string) (*model.Channel, error) {
	for _, c := range m.channels {
		if c.Slug == slug {
			return c, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}
func (m *mockChannelRepoH) List(page, perPage int) ([]model.Channel, int64, error) {
	var chs []model.Channel
	for _, c := range m.channels {
		chs = append(chs, *c)
	}
	return chs, int64(len(chs)), nil
}
func (m *mockChannelRepoH) ListActive(page, perPage int, search string, categoryID *uint) ([]model.Channel, int64, error) {
	var chs []model.Channel
	for _, c := range m.channels {
		if c.IsActive {
			chs = append(chs, *c)
		}
	}
	return chs, int64(len(chs)), nil
}
func (m *mockChannelRepoH) Create(channel *model.Channel) error {
	channel.ID = m.nextID
	m.nextID++
	m.channels[channel.ID] = channel
	return nil
}
func (m *mockChannelRepoH) Update(channel *model.Channel) error {
	m.channels[channel.ID] = channel
	return nil
}
func (m *mockChannelRepoH) Delete(id uint) error {
	if _, ok := m.channels[id]; !ok {
		return gorm.ErrRecordNotFound
	}
	delete(m.channels, id)
	return nil
}
func (m *mockChannelRepoH) Count() (int64, error)                      { return int64(len(m.channels)), nil }
func (m *mockChannelRepoH) CountActive() (int64, error)                { return int64(len(m.channels)), nil }
func (m *mockChannelRepoH) CountBySource(source string) (int64, error) { return 0, nil }
func (m *mockChannelRepoH) DeleteBySource(source string) error         { return nil }
func (m *mockChannelRepoH) addChannel(ch *model.Channel) {
	if ch.ID == 0 {
		ch.ID = m.nextID
		m.nextID++
	}
	m.channels[ch.ID] = ch
}

type mockStreamRepoH struct {
	streams map[uint]*model.Stream
	nextID  uint
}

func newMockStreamRepoH() *mockStreamRepoH {
	return &mockStreamRepoH{streams: make(map[uint]*model.Stream), nextID: 1}
}
func (m *mockStreamRepoH) FindByID(id uint) (*model.Stream, error) {
	s, ok := m.streams[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return s, nil
}
func (m *mockStreamRepoH) ListByChannel(channelID uint) ([]model.Stream, error) {
	var ss []model.Stream
	for _, s := range m.streams {
		if s.ChannelID == channelID {
			ss = append(ss, *s)
		}
	}
	return ss, nil
}
func (m *mockStreamRepoH) Create(stream *model.Stream) error {
	stream.ID = m.nextID
	m.nextID++
	m.streams[stream.ID] = stream
	return nil
}
func (m *mockStreamRepoH) Update(stream *model.Stream) error {
	m.streams[stream.ID] = stream
	return nil
}
func (m *mockStreamRepoH) Delete(id uint) error {
	delete(m.streams, id)
	return nil
}
func (m *mockStreamRepoH) DeleteByChannel(channelID uint) error { return nil }

// --- VOD mock repo ---

type mockVODRepoH struct {
	vods   map[uint]*model.VOD
	nextID uint
}

func newMockVODRepoH() *mockVODRepoH {
	return &mockVODRepoH{vods: make(map[uint]*model.VOD), nextID: 1}
}
func (m *mockVODRepoH) FindByID(id uint) (*model.VOD, error) {
	v, ok := m.vods[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return v, nil
}
func (m *mockVODRepoH) FindBySlug(slug string) (*model.VOD, error) {
	for _, v := range m.vods {
		if v.Slug == slug {
			return v, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}
func (m *mockVODRepoH) List(page, perPage int) ([]model.VOD, int64, error) {
	var vs []model.VOD
	for _, v := range m.vods {
		vs = append(vs, *v)
	}
	return vs, int64(len(vs)), nil
}
func (m *mockVODRepoH) ListActive(page, perPage int, search string, categoryID *uint) ([]model.VOD, int64, error) {
	var vs []model.VOD
	for _, v := range m.vods {
		if v.IsActive {
			vs = append(vs, *v)
		}
	}
	return vs, int64(len(vs)), nil
}
func (m *mockVODRepoH) ListBySeries(seriesID uint) ([]model.VOD, error) {
	var vs []model.VOD
	for _, v := range m.vods {
		if v.SeriesID != nil && *v.SeriesID == seriesID {
			vs = append(vs, *v)
		}
	}
	return vs, nil
}
func (m *mockVODRepoH) Create(vod *model.VOD) error {
	vod.ID = m.nextID
	m.nextID++
	m.vods[vod.ID] = vod
	return nil
}
func (m *mockVODRepoH) Update(vod *model.VOD) error {
	m.vods[vod.ID] = vod
	return nil
}
func (m *mockVODRepoH) Delete(id uint) error {
	if _, ok := m.vods[id]; !ok {
		return gorm.ErrRecordNotFound
	}
	delete(m.vods, id)
	return nil
}
func (m *mockVODRepoH) Count() (int64, error)                                        { return int64(len(m.vods)), nil }
func (m *mockVODRepoH) CountActive() (int64, error)                                  { return int64(len(m.vods)), nil }
func (m *mockVODRepoH) ListRecent(limit int) ([]model.VOD, error)                    { return nil, nil }
func (m *mockVODRepoH) ListByTranscodeStatus(statuses []string) ([]model.VOD, error) { return nil, nil }
func (m *mockVODRepoH) ListWithoutPoster() ([]model.VOD, error)                      { return nil, nil }
func (m *mockVODRepoH) DebugAll() ([]model.VOD, error) {
	var vs []model.VOD
	for _, v := range m.vods {
		vs = append(vs, *v)
	}
	return vs, nil
}
func (m *mockVODRepoH) addVOD(v *model.VOD) {
	if v.ID == 0 {
		v.ID = m.nextID
		m.nextID++
	}
	m.vods[v.ID] = v
}

// --- Series mock repo ---

type mockSeriesRepoH struct {
	series map[uint]*model.Series
	nextID uint
}

func newMockSeriesRepoH() *mockSeriesRepoH {
	return &mockSeriesRepoH{series: make(map[uint]*model.Series), nextID: 1}
}
func (m *mockSeriesRepoH) FindByID(id uint) (*model.Series, error) {
	s, ok := m.series[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return s, nil
}
func (m *mockSeriesRepoH) FindBySlug(slug string) (*model.Series, error) {
	for _, s := range m.series {
		if s.Slug == slug {
			return s, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}
func (m *mockSeriesRepoH) List(page, perPage int) ([]model.Series, int64, error) {
	var ss []model.Series
	for _, s := range m.series {
		ss = append(ss, *s)
	}
	return ss, int64(len(ss)), nil
}
func (m *mockSeriesRepoH) ListActive(page, perPage int, search string, categoryID *uint) ([]model.Series, int64, error) {
	var ss []model.Series
	for _, s := range m.series {
		if s.IsActive {
			ss = append(ss, *s)
		}
	}
	return ss, int64(len(ss)), nil
}
func (m *mockSeriesRepoH) Create(series *model.Series) error {
	series.ID = m.nextID
	m.nextID++
	m.series[series.ID] = series
	return nil
}
func (m *mockSeriesRepoH) Update(series *model.Series) error {
	m.series[series.ID] = series
	return nil
}
func (m *mockSeriesRepoH) Delete(id uint) error {
	if _, ok := m.series[id]; !ok {
		return gorm.ErrRecordNotFound
	}
	delete(m.series, id)
	return nil
}
func (m *mockSeriesRepoH) Count() (int64, error)                      { return int64(len(m.series)), nil }
func (m *mockSeriesRepoH) CountActive() (int64, error)                { return int64(len(m.series)), nil }
func (m *mockSeriesRepoH) CountEpisodes(seriesID uint) (int64, error) { return 0, nil }
func (m *mockSeriesRepoH) ListWithoutPoster() ([]model.Series, error) { return nil, nil }
func (m *mockSeriesRepoH) addSeries(s *model.Series) {
	if s.ID == 0 {
		s.ID = m.nextID
		m.nextID++
	}
	m.series[s.ID] = s
}

// --- Favorite mock repo ---

type mockFavoriteRepoH struct {
	favorites map[uint]*model.Favorite
	nextID    uint
}

func newMockFavoriteRepoH() *mockFavoriteRepoH {
	return &mockFavoriteRepoH{favorites: make(map[uint]*model.Favorite), nextID: 1}
}
func (m *mockFavoriteRepoH) FindByUserAndItem(userID uuid.UUID, favType string, favID uint) (*model.Favorite, error) {
	for _, f := range m.favorites {
		if f.UserID == userID && f.FavoritableType == favType && f.FavoritableID == favID {
			return f, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}
func (m *mockFavoriteRepoH) ListByUser(userID uuid.UUID, page, perPage int) ([]model.Favorite, int64, error) {
	var fs []model.Favorite
	for _, f := range m.favorites {
		if f.UserID == userID {
			fs = append(fs, *f)
		}
	}
	return fs, int64(len(fs)), nil
}
func (m *mockFavoriteRepoH) Create(fav *model.Favorite) error {
	fav.ID = m.nextID
	m.nextID++
	m.favorites[fav.ID] = fav
	return nil
}
func (m *mockFavoriteRepoH) Delete(id uint) error {
	delete(m.favorites, id)
	return nil
}
func (m *mockFavoriteRepoH) DeleteByUserAndItem(userID uuid.UUID, favType string, favID uint) error {
	for id, f := range m.favorites {
		if f.UserID == userID && f.FavoritableType == favType && f.FavoritableID == favID {
			delete(m.favorites, id)
			return nil
		}
	}
	return nil
}

// --- WatchHistory mock repo ---

type mockWatchHistoryRepoH struct {
	entries map[uint]*model.WatchHistory
	nextID  uint
}

func newMockWatchHistoryRepoH() *mockWatchHistoryRepoH {
	return &mockWatchHistoryRepoH{entries: make(map[uint]*model.WatchHistory), nextID: 1}
}
func (m *mockWatchHistoryRepoH) ListByUser(userID uuid.UUID, page, perPage int) ([]model.WatchHistory, int64, error) {
	var es []model.WatchHistory
	for _, e := range m.entries {
		if e.UserID == userID {
			es = append(es, *e)
		}
	}
	return es, int64(len(es)), nil
}
func (m *mockWatchHistoryRepoH) Upsert(entry *model.WatchHistory) error {
	if entry.ID == 0 {
		entry.ID = m.nextID
		m.nextID++
	}
	m.entries[entry.ID] = entry
	return nil
}
func (m *mockWatchHistoryRepoH) ListContinueWatching(userID uuid.UUID, limit int) ([]model.WatchHistory, error) {
	var es []model.WatchHistory
	for _, e := range m.entries {
		if e.UserID == userID {
			es = append(es, *e)
		}
	}
	return es, nil
}
func (m *mockWatchHistoryRepoH) Delete(id uint, userID uuid.UUID) error {
	delete(m.entries, id)
	return nil
}

// --- EPG mock repo ---

type mockEPGRepoH struct {
	entries map[uint]*model.EPGEntry
	nextID  uint
}

func newMockEPGRepoH() *mockEPGRepoH {
	return &mockEPGRepoH{entries: make(map[uint]*model.EPGEntry), nextID: 1}
}
func (m *mockEPGRepoH) FindByID(id uint) (*model.EPGEntry, error) {
	e, ok := m.entries[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return e, nil
}
func (m *mockEPGRepoH) List(page, perPage int) ([]model.EPGEntry, int64, error) {
	var es []model.EPGEntry
	for _, e := range m.entries {
		es = append(es, *e)
	}
	return es, int64(len(es)), nil
}
func (m *mockEPGRepoH) ListByChannel(channelID uint, date time.Time) ([]model.EPGEntry, error) {
	var es []model.EPGEntry
	for _, e := range m.entries {
		if e.ChannelID == channelID {
			es = append(es, *e)
		}
	}
	return es, nil
}
func (m *mockEPGRepoH) Create(entry *model.EPGEntry) error {
	entry.ID = m.nextID
	m.nextID++
	m.entries[entry.ID] = entry
	return nil
}
func (m *mockEPGRepoH) Update(entry *model.EPGEntry) error {
	m.entries[entry.ID] = entry
	return nil
}
func (m *mockEPGRepoH) Delete(id uint) error {
	if _, ok := m.entries[id]; !ok {
		return gorm.ErrRecordNotFound
	}
	delete(m.entries, id)
	return nil
}
func (m *mockEPGRepoH) Count() (int64, error) { return int64(len(m.entries)), nil }

// --- Emission mock repo ---

type mockEmissionRepoH struct {
	emissions map[uint]*model.Emission
	nextID    uint
}

func newMockEmissionRepoH() *mockEmissionRepoH {
	return &mockEmissionRepoH{emissions: make(map[uint]*model.Emission), nextID: 1}
}
func (m *mockEmissionRepoH) FindByChannelID(channelID uint) (*model.Emission, error) {
	for _, e := range m.emissions {
		if e.ChannelID == channelID {
			return e, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}
func (m *mockEmissionRepoH) FindAllRunning() ([]model.Emission, error) {
	var es []model.Emission
	for _, e := range m.emissions {
		if e.Status == "running" || e.Status == "starting" {
			es = append(es, *e)
		}
	}
	return es, nil
}
func (m *mockEmissionRepoH) Create(emission *model.Emission) error {
	emission.ID = m.nextID
	m.nextID++
	m.emissions[emission.ID] = emission
	return nil
}
func (m *mockEmissionRepoH) Save(emission *model.Emission) error {
	m.emissions[emission.ID] = emission
	return nil
}
func (m *mockEmissionRepoH) UpdateStatus(channelID uint, status string, pid int, errMsg string) error {
	for _, e := range m.emissions {
		if e.ChannelID == channelID {
			e.Status = status
			e.PID = pid
			e.Error = errMsg
			return nil
		}
	}
	return nil
}
func (m *mockEmissionRepoH) ListAll() ([]model.Emission, error) {
	var es []model.Emission
	for _, e := range m.emissions {
		es = append(es, *e)
	}
	return es, nil
}

// --- Playlist mock repo ---

type mockPlaylistRepoH struct {
	playlists  map[uint]*model.Playlist
	items      map[uint]*model.PlaylistItem
	nextID     uint
	nextItemID uint
}

func newMockPlaylistRepoH() *mockPlaylistRepoH {
	return &mockPlaylistRepoH{
		playlists:  make(map[uint]*model.Playlist),
		items:      make(map[uint]*model.PlaylistItem),
		nextID:     1,
		nextItemID: 1,
	}
}
func (m *mockPlaylistRepoH) FindByChannelID(channelID uint) (*model.Playlist, error) {
	for _, p := range m.playlists {
		if p.ChannelID == channelID {
			var items []model.PlaylistItem
			for _, item := range m.items {
				if item.PlaylistID == p.ID {
					items = append(items, *item)
				}
			}
			p.Items = items
			return p, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}
func (m *mockPlaylistRepoH) Create(playlist *model.Playlist) error {
	playlist.ID = m.nextID
	m.nextID++
	m.playlists[playlist.ID] = playlist
	return nil
}
func (m *mockPlaylistRepoH) Update(playlist *model.Playlist) error {
	m.playlists[playlist.ID] = playlist
	return nil
}
func (m *mockPlaylistRepoH) AddItem(item *model.PlaylistItem) error {
	item.ID = m.nextItemID
	m.nextItemID++
	m.items[item.ID] = item
	return nil
}
func (m *mockPlaylistRepoH) RemoveItem(itemID uint) error {
	delete(m.items, itemID)
	return nil
}
func (m *mockPlaylistRepoH) FindItemByID(itemID uint) (*model.PlaylistItem, error) {
	item, ok := m.items[itemID]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return item, nil
}
func (m *mockPlaylistRepoH) ReorderItems(playlistID uint, items []struct {
	ID        uint
	SortOrder int
}) error {
	for _, req := range items {
		if item, ok := m.items[req.ID]; ok {
			item.SortOrder = req.SortOrder
		}
	}
	return nil
}
func (m *mockPlaylistRepoH) DeleteByChannelID(channelID uint) error {
	for id, p := range m.playlists {
		if p.ChannelID == channelID {
			delete(m.playlists, id)
			for itemID, item := range m.items {
				if item.PlaylistID == id {
					delete(m.items, itemID)
				}
			}
			return nil
		}
	}
	return gorm.ErrRecordNotFound
}

// --- LocalMedia mock repo ---

type mockLocalMediaRepoH struct {
	media  map[uint]*model.LocalMedia
	nextID uint
}

func newMockLocalMediaRepoH() *mockLocalMediaRepoH {
	return &mockLocalMediaRepoH{media: make(map[uint]*model.LocalMedia), nextID: 1}
}
func (m *mockLocalMediaRepoH) Create(media *model.LocalMedia) error {
	media.ID = m.nextID
	m.nextID++
	m.media[media.ID] = media
	return nil
}
func (m *mockLocalMediaRepoH) FindByID(id uint) (*model.LocalMedia, error) {
	media, ok := m.media[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return media, nil
}
func (m *mockLocalMediaRepoH) List(page, perPage int) ([]model.LocalMedia, int64, error) {
	var ms []model.LocalMedia
	for _, media := range m.media {
		ms = append(ms, *media)
	}
	return ms, int64(len(ms)), nil
}
func (m *mockLocalMediaRepoH) Update(media *model.LocalMedia) error {
	m.media[media.ID] = media
	return nil
}
func (m *mockLocalMediaRepoH) UpdateStatus(id uint, status string, progress int, errorMsg string) error {
	if media, ok := m.media[id]; ok {
		media.Status = status
		media.Progress = progress
		media.ErrorMessage = errorMsg
	}
	return nil
}
func (m *mockLocalMediaRepoH) Delete(id uint) error {
	delete(m.media, id)
	return nil
}
func (m *mockLocalMediaRepoH) FindPendingTranscodes() ([]model.LocalMedia, error) { return nil, nil }
func (m *mockLocalMediaRepoH) ListRecent(limit int) ([]model.LocalMedia, error)   { return nil, nil }

// --- LibraryScanner mock repo ---

type mockLibraryScannerRepoH struct {
	items  map[uint]*model.LibraryScanItem
	nextID uint
}

func newMockLibraryScannerRepoH() *mockLibraryScannerRepoH {
	return &mockLibraryScannerRepoH{items: make(map[uint]*model.LibraryScanItem), nextID: 1}
}
func (m *mockLibraryScannerRepoH) Create(item *model.LibraryScanItem) error {
	item.ID = m.nextID
	m.nextID++
	m.items[item.ID] = item
	return nil
}
func (m *mockLibraryScannerRepoH) CreateBatch(items []model.LibraryScanItem) error {
	for i := range items {
		items[i].ID = m.nextID
		m.nextID++
		m.items[items[i].ID] = &items[i]
	}
	return nil
}
func (m *mockLibraryScannerRepoH) FindByID(id uint) (*model.LibraryScanItem, error) {
	item, ok := m.items[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return item, nil
}
func (m *mockLibraryScannerRepoH) FindBySessionID(sessionID string, page, perPage int) ([]model.LibraryScanItem, int64, error) {
	var items []model.LibraryScanItem
	for _, item := range m.items {
		if item.ScanSessionID == sessionID {
			items = append(items, *item)
		}
	}
	return items, int64(len(items)), nil
}
func (m *mockLibraryScannerRepoH) FindPendingBySessionID(sessionID string) ([]model.LibraryScanItem, error) {
	var items []model.LibraryScanItem
	for _, item := range m.items {
		if item.ScanSessionID == sessionID && item.ImportStatus == "pending" {
			items = append(items, *item)
		}
	}
	return items, nil
}
func (m *mockLibraryScannerRepoH) FindByIDs(ids []uint) ([]model.LibraryScanItem, error) {
	var items []model.LibraryScanItem
	for _, id := range ids {
		if item, ok := m.items[id]; ok {
			items = append(items, *item)
		}
	}
	return items, nil
}
func (m *mockLibraryScannerRepoH) Update(item *model.LibraryScanItem) error {
	m.items[item.ID] = item
	return nil
}
func (m *mockLibraryScannerRepoH) UpdateImportStatus(id uint, status string, vodID *uint, seriesID *uint, errMsg string) error {
	if item, ok := m.items[id]; ok {
		item.ImportStatus = status
		item.ImportedVODID = vodID
		item.ImportedSeriesID = seriesID
		item.ErrorMessage = errMsg
	}
	return nil
}
func (m *mockLibraryScannerRepoH) DeleteBySessionID(sessionID string) error {
	for id, item := range m.items {
		if item.ScanSessionID == sessionID {
			delete(m.items, id)
		}
	}
	return nil
}
func (m *mockLibraryScannerRepoH) ExistsFilePath(filePath string) (bool, error) {
	for _, item := range m.items {
		if item.FilePath == filePath {
			return true, nil
		}
	}
	return false, nil
}
func (m *mockLibraryScannerRepoH) CountBySessionID(sessionID string) (int64, error) {
	var count int64
	for _, item := range m.items {
		if item.ScanSessionID == sessionID {
			count++
		}
	}
	return count, nil
}

func createTestUserH(username, password string) *model.User {
	hash, _ := util.HashPassword(password)
	return &model.User{
		ID:             uuid.New(),
		Username:       username,
		Email:          username + "@test.com",
		PasswordHash:   hash,
		Role:           "user",
		IsActive:       true,
		MaxConnections: 1,
	}
}

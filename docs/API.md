# API Reference

Base URL: `/api/v1`

All responses follow the format:

```json
{
  "success": true,
  "data": { ... },
  "message": "optional message"
}
```

Paginated responses include:

```json
{
  "success": true,
  "data": [...],
  "total": 150,
  "page": 1,
  "per_page": 20,
  "pages": 8
}
```

## Authentication

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/auth/login` | No | 5/min | Login with username and password |
| POST | `/auth/refresh` | Cookie | 5/min | Refresh access token |
| POST | `/auth/logout` | Yes | 5/min | Logout and clear refresh token |
| GET | `/auth/me` | Yes | -- | Get current user profile |
| PUT | `/profile` | Yes | -- | Update profile (email) |
| PUT | `/profile/password` | Yes | -- | Change password |

### Login

```
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-password"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbG...",
    "user": {
      "id": "uuid",
      "username": "admin",
      "email": "admin@tivify.local",
      "role": "admin"
    }
  }
}
```

A `refresh_token` HttpOnly cookie is also set.

### Using the token

All authenticated requests require:

```
Authorization: Bearer <access_token>
```

## User Endpoints

### Channels

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/channels` | List active channels (paginated) |
| GET | `/channels/:id` | Get channel by ID |

Query parameters: `page`, `per_page`, `category_id`, `search`

### VOD

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/vod` | List active VODs (paginated) |
| GET | `/vod/:id` | Get VOD by ID |

Query parameters: `page`, `per_page`, `category_id`, `search`

### Series

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/series` | List active series (paginated) |
| GET | `/series/:id` | Get series by ID |
| GET | `/series/:id/episodes` | Get episodes for a series |

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/categories` | List categories by type |

Query parameters: `type` (live, vod, series)

### EPG

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/epg` | EPG entries by channel and date |

Query parameters: `channel_id`, `date` (YYYY-MM-DD)

### Favorites

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/favorites` | List user favorites |
| POST | `/favorites/toggle` | Add or remove a favorite |

Toggle body:

```json
{
  "favoritable_type": "channel",
  "favoritable_id": 42
}
```

### Watch History

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/history` | Recent watch history |
| GET | `/history/continue` | Continue watching list |
| POST | `/history` | Record watch progress |
| DELETE | `/history/:id` | Delete history entry |

Record body:

```json
{
  "content_type": "vod",
  "content_id": 42,
  "progress": 300,
  "duration": 7200
}
```

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search` | Search channels, VOD, and series |

Query parameters: `q` (search term, max 200 chars)

### Emissions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/emissions/live` | List active live streams |

## Admin Endpoints

All admin endpoints require `role: admin`.

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard/stats` | Overview statistics |

### Categories (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/categories` | List all categories |
| GET | `/admin/categories/by-type` | List grouped by type |
| GET | `/admin/categories/:id` | Get by ID |
| POST | `/admin/categories` | Create category |
| PUT | `/admin/categories/:id` | Update category |
| DELETE | `/admin/categories/:id` | Delete category |

### Channels (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/channels` | List all channels |
| GET | `/admin/channels/:id` | Get by ID |
| POST | `/admin/channels` | Create channel with streams |
| PUT | `/admin/channels/:id` | Update channel |
| DELETE | `/admin/channels/:id` | Delete channel |
| POST | `/admin/channels/:id/streams` | Add stream |
| PUT | `/admin/channels/:id/streams/:streamId` | Update stream |
| DELETE | `/admin/channels/:id/streams/:streamId` | Delete stream |

### Channel Playlists

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/channels/:id/playlist` | Get playlist |
| POST | `/admin/channels/:id/playlist/items` | Add item |
| DELETE | `/admin/channels/:id/playlist/items/:itemId` | Remove item |
| PUT | `/admin/channels/:id/playlist/reorder` | Reorder items |
| PUT | `/admin/channels/:id/playlist/mode` | Set playback mode |
| POST | `/admin/channels/:id/playlist/generate` | Generate HLS |

### Emissions (FFmpeg)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/channels/:id/emission/start` | Start live emission |
| POST | `/admin/channels/:id/emission/stop` | Stop emission |
| GET | `/admin/channels/:id/emission/status` | Emission status |

### VOD (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/vod` | List all VODs |
| GET | `/admin/vod/:id` | Get by ID |
| POST | `/admin/vod` | Create VOD |
| PUT | `/admin/vod/:id` | Update VOD |
| DELETE | `/admin/vod/:id` | Delete VOD |
| POST | `/admin/vod/enrich` | TMDB metadata enrichment |

### Series (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/series` | List all series |
| GET | `/admin/series/:id` | Get by ID |
| POST | `/admin/series` | Create series |
| PUT | `/admin/series/:id` | Update series |
| DELETE | `/admin/series/:id` | Delete series |
| POST | `/admin/series/enrich` | TMDB enrichment |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | List users |
| GET | `/admin/users/:id` | Get by ID |
| POST | `/admin/users` | Create user |
| PUT | `/admin/users/:id` | Update user |
| DELETE | `/admin/users/:id` | Delete user (soft) |

### Media Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/media/upload` | Upload video file (10GB max) |
| POST | `/admin/media/upload-vod` | Upload and create VOD directly |
| GET | `/admin/media` | List uploaded media |
| GET | `/admin/media/:id` | Get media status/progress |
| DELETE | `/admin/media/:id` | Delete media |
| POST | `/admin/media/:id/create-vod` | Create VOD from media |

### Library Scanner

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/library/devices` | List storage devices |
| POST | `/admin/library/scan` | Start scan (1 req/30s) |
| GET | `/admin/library/scan/:sessionId/status` | Scan progress |
| GET | `/admin/library/scan/:sessionId` | Scan results |
| PUT | `/admin/library/scan/items/:id` | Update scanned item |
| POST | `/admin/library/import` | Import scanned items |
| POST | `/admin/library/tmdb/search` | Search TMDB |
| GET | `/admin/library/tmdb/status` | TMDB API status |

### IPTV Import

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/iptv/import` | Import from M3U URL |
| GET | `/admin/iptv/status` | Import status |
| DELETE | `/admin/iptv/channels` | Delete channels by source |

### EPG (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/epg` | List EPG entries |
| GET | `/admin/epg/:id` | Get by ID |
| POST | `/admin/epg` | Create entry |
| PUT | `/admin/epg/:id` | Update entry |
| DELETE | `/admin/epg/:id` | Delete entry |

### Tailscale

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/tailscale/status` | VPN tunnel status |
| POST | `/admin/tailscale/start` | Start Tailscale |
| POST | `/admin/tailscale/stop` | Stop Tailscale |
| POST | `/admin/tailscale/restart` | Restart Tailscale |

## Xtream Codes Compatibility

For third-party IPTV players that support Xtream Codes:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/player_api.php` | Xtream Codes API |
| GET/POST | `/xmltv.php` | EPG in XMLTV format |
| GET/POST | `/get.php` | Stream delivery |
| GET | `/live/:user/:pass/:id` | Live stream |
| GET | `/movie/:user/:pass/:id` | VOD stream |
| GET | `/series/:user/:pass/:id` | Series stream |

## Infrastructure

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (DB + Redis) |
| GET | `/api/version` | Server version info |

## Rate Limits

| Scope | Limit |
|-------|-------|
| Auth endpoints | 5 requests/minute per IP |
| API operations | 60 requests/minute per IP |
| Read operations | 120 requests/minute per IP |
| Media uploads | 5 uploads/minute per user |
| Library scan | 1 request/30 seconds per IP |

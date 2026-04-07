# Architecture

## System Overview

TIVIFY follows a standard three-tier architecture with an additional native mobile client:

```
┌─────────────┐    ┌─────────────┐    ┌──────────────────┐
│  Android App │    │  Next.js    │    │  Xtream Codes    │
│  (Kotlin)    │    │  Frontend   │    │  Clients         │
└──────┬───────┘    └──────┬──────┘    └────────┬─────────┘
       │                   │                    │
       └───────────┬───────┴────────────────────┘
                   │  HTTPS
            ┌──────┴──────┐
            │    Nginx    │  Reverse proxy, rate limiting,
            │             │  static files, stream auth
            └──────┬──────┘
                   │
            ┌──────┴──────┐
            │   Backend   │  Go/Fiber REST API
            │   :8080     │  Business logic, auth, transcoding
            └──┬───────┬──┘
               │       │
        ┌──────┴──┐ ┌──┴──────┐
        │ Postgres│ │  Redis  │
        │  :5432  │ │  :6379  │
        └─────────┘ └─────────┘
```

## Components

### Nginx (Reverse Proxy)

Entry point for all HTTP traffic. Responsibilities:

- Route `/api/*` to the Go backend
- Route `/` to the Next.js frontend
- Serve media files directly from disk (`/media/*`)
- Authenticate HLS manifest requests via `auth_request` to the backend
- Cache HLS segments (10s) and media files (1h)
- Rate limit auth (5/min) and API (30/s) endpoints
- Apply security headers (CSP, HSTS, X-Frame-Options)
- Handle CORS for same-origin requests

### Backend (Go/Fiber)

Core application server. Layered architecture:

```
Handler → Service → Repository → Database
```

- **Handlers** (16): Parse HTTP requests, validate input, return JSON responses
- **Services** (16): Business logic, transcoding orchestration, IPTV import
- **Repositories** (14): GORM-based data access, query building, pagination
- **Models** (16): Database schema defined as Go structs with GORM tags
- **Middleware**: JWT auth, role checks, rate limiting, CORS, internal-only guards

Key background processes:
- Session cleanup (hourly cron)
- Resume pending transcodes on startup
- Cleanup orphaned FFmpeg emissions
- Optional IPTV seed from M3U URL

### Frontend (Next.js 14)

Server-side rendered web application using App Router:

- **User pages**: Home, Channels, VOD, Series, Favorites, History, EPG, Settings, Help
- **Admin pages**: Dashboard, Channels, VOD, Series, Categories, Library, IPTV, EPG, Users, Tailscale
- **Auth**: In-memory token store, automatic refresh on 401, HttpOnly refresh token cookie
- **API client**: Axios with interceptors, exponential backoff retry (3 attempts)

### Android App (Kotlin/Compose)

Native app optimized for phones, tablets, and Android TV:

- **Architecture**: MVVM with Hilt DI
- **State**: `ViewModel + StateFlow<State>` per screen
- **Navigation**: Compose Navigation with sealed route classes
- **Player**: ExoPlayer with HLS support, D-pad controls, TV safe area
- **Auth**: DataStore-based token persistence, cached interceptor credentials

### PostgreSQL

Primary data store with 16 tables. Key relationships:

```
users ──< sessions
users ──< favorites
users ──< watch_history
categories ──< channels
categories ──< vods
categories ──< series
channels ──< streams
channels ──< epg_entries
channels ──< emissions
channels ──< playlists ──< playlist_items
series ──< vods (as episodes)
```

Connection pool: 10 idle, 100 max open, 1h max lifetime.

### Redis

Session cache and general-purpose cache layer:
- Category lists cached with TTL
- Prefix-based key invalidation
- Pipeline support for batch operations

## Data Flows

### Authentication

```
1. POST /api/v1/auth/login {username, password}
2. Backend verifies bcrypt hash
3. Returns JWT access token (15min) + sets HttpOnly refresh token cookie (7d)
4. Subsequent requests: Authorization: Bearer <token>
5. On 401: auto-refresh via POST /api/v1/auth/refresh (uses cookie)
6. On refresh failure: redirect to login
```

### Video Playback (VOD)

```
1. Client fetches VOD metadata: GET /api/v1/vod/:id
2. Response includes hls_path (e.g., /media/vod/42/playlist.m3u8)
3. Client requests HLS manifest via Nginx
4. Nginx auth_request validates JWT with backend
5. Nginx serves .m3u8 (no-cache) and .ts segments (10s cache)
6. Client periodically records watch progress: POST /api/v1/history
```

### VOD Upload & Transcoding

```
1. Admin uploads video: POST /api/v1/admin/media/upload (up to 10GB)
2. File saved to /media/uploads/, LocalMedia record created (status: pending)
3. Background goroutine starts FFmpeg transcoding to HLS
4. Progress updated in DB (0-100%)
5. On completion: VOD record created, status → completed
6. On failure: status → failed, error message stored
```

### IPTV Import

```
1. Admin triggers: POST /api/v1/admin/iptv/import {m3u_url, source}
2. Backend downloads and parses M3U file
3. For each entry: create/update Channel + Stream records
4. Source field prevents overwriting manually created channels
5. Re-import same source: updates existing, preserves manual entries
```

## Security Model

- **JWT tokens**: HS256 signed, configurable expiry
- **Refresh tokens**: HttpOnly cookies with rotation
- **Password hashing**: bcrypt
- **Rate limiting**: per-IP, configurable per endpoint type
- **Stream auth**: Nginx auth_request validates tokens for media access
- **CORS**: Origin-based validation, credentials allowed
- **Input validation**: URL validation (SSRF prevention), length limits, type checks
- **Role-based access**: admin middleware on admin routes

## File Storage

```
/media/
├── uploads/     # Raw uploaded files (pre-transcoding)
├── vod/         # Transcoded HLS content (playlist.m3u8 + segments)
├── thumbnails/  # Generated video thumbnails
└── live/        # Live emission HLS output
```

Nginx serves these directly from disk, bypassing the backend for performance.

# Development Setup

## Prerequisites

- Docker and Docker Compose (for PostgreSQL and Redis)
- Node.js 18+ (for frontend)
- Go 1.22+ (for backend, optional if using Docker)

## Quick Start

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env -- defaults work for local development
```

### 2. Start infrastructure

```bash
make dev-up
```

This starts PostgreSQL (port 5432) and Redis (port 6379) in Docker containers. All other services (backend, frontend, nginx, tailscale) are excluded via the dev compose override.

### 3. Start backend

```bash
make backend-dev
```

The Go backend starts on `http://localhost:8080` with auto-reload on code changes.

### 4. Start frontend

```bash
cd frontend
npm install
npm run dev
```

The Next.js dev server starts on `http://localhost:3000` with hot module replacement.

### 5. Access

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080/api/v1
- **Health check**: http://localhost:8080/health

In development the frontend calls the backend directly (configured via `NEXT_PUBLIC_API_URL` in `.env`). In production, nginx proxies both behind a single origin.

## Project Structure

### Backend (`backend/`)

```
backend/
├── cmd/server/main.go           # Entry point, service wiring
└── internal/
    ├── config/config.go         # Environment variable loading
    ├── database/
    │   ├── postgres.go          # PostgreSQL connection
    │   ├── redis.go             # Redis connection
    │   └── migrations.go        # Auto-migrate on startup
    ├── cache/cache.go           # Redis cache wrapper
    ├── model/                   # GORM models (16 tables)
    ├── dto/                     # Request/response DTOs
    ├── repository/              # Data access layer
    ├── service/                 # Business logic
    ├── handler/                 # HTTP handlers
    ├── middleware/               # Auth, rate limiting, CORS
    ├── router/router.go         # Route definitions
    └── util/                    # Helpers (slug generation, validation)
```

Adding a new feature typically involves:

1. Define the model in `model/`
2. Add migration in `database/migrations.go`
3. Create repository in `repository/`
4. Write service logic in `service/`
5. Expose via handler in `handler/`
6. Register routes in `router/router.go`

### Frontend (`frontend/src/`)

```
src/
├── app/                         # Next.js App Router
│   ├── (auth)/login/            # Login page
│   ├── (user)/                  # Authenticated user pages
│   │   ├── home/
│   │   ├── channels/
│   │   ├── vod/
│   │   ├── series/
│   │   ├── favorites/
│   │   ├── history/
│   │   ├── guide/
│   │   └── settings/
│   └── admin/                   # Admin pages
├── components/ui/               # Reusable components
├── context/
│   ├── auth-context.tsx         # Global auth state
│   └── toast-context.tsx        # Toast notifications
└── lib/
    ├── api.ts                   # Axios client with interceptors
    ├── types.ts                 # TypeScript interfaces
    ├── constants.ts             # Configuration values
    ├── routes.ts                # Route path definitions
    └── validation.ts            # Form validation helpers
```

### Android (`android/`)

```
android/app/src/main/java/com/tivify/app/
├── MainActivity.kt              # Entry point
├── TivifyApp.kt                 # Application class (Hilt + Coil)
├── data/
│   ├── TokenManager.kt          # DataStore auth persistence
│   └── api/
│       ├── TivifyApi.kt         # Retrofit interface
│       ├── Models.kt            # API DTOs
│       └── AuthInterceptor.kt   # OkHttp interceptors
├── di/AppModule.kt              # Hilt DI configuration
├── ui/
│   ├── navigation/AppNavigation.kt
│   ├── theme/                   # Colors, typography
│   ├── components/              # Shared composables
│   └── screens/                 # Feature screens (13 screens)
│       ├── splash/
│       ├── login/
│       ├── home/
│       ├── channels/
│       ├── vod/
│       ├── series/
│       ├── player/
│       ├── favorites/
│       ├── history/
│       ├── epg/
│       ├── profile/
│       ├── help/
│       └── about/
└── util/                        # Constants, retry, time formatting
```

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make dev-up` | Start PostgreSQL + Redis containers |
| `make dev-down` | Stop all containers |
| `make backend-dev` | Run Go backend locally |
| `make frontend-dev` | Run Next.js dev server |
| `make build` | Build Docker images |
| `make up` | Start full production stack |
| `make down` | Stop all services |
| `make logs` | Tail all service logs |
| `make logs-<service>` | Tail specific service logs |

## Testing

### Frontend

```bash
cd frontend
npm test            # Run tests once
npm run test:watch  # Watch mode
```

### Backend

```bash
cd backend
go test ./...
```

## Database

The backend auto-migrates on startup. To connect directly:

```bash
docker exec -it tivify-postgres psql -U tivify -d tivify
```

## Code Conventions

- **Backend**: Standard Go project layout, `internal/` for private packages
- **Frontend**: Next.js App Router conventions, Tailwind utility classes
- **Android**: MVVM pattern, one ViewModel per screen, state as `data class`
- **Naming**: Slugs auto-generated from names, UUIDs for user IDs, auto-increment for content IDs
- **Errors**: Handlers return structured JSON errors, services return Go errors
- **Pagination**: `page` + `per_page` query params, max 100 per page

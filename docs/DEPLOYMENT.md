# Production Deployment

## Prerequisites

- Linux server (Ubuntu 22.04+ recommended)
- Docker Engine 24+ and Docker Compose v2
- At least 2GB RAM, 2 CPU cores
- Storage for media files (depends on content volume)

## 1. Clone and Configure

```bash
git clone <repo-url> /opt/tivify
cd /opt/tivify
cp .env.example .env
```

## 2. Security Configuration

Edit `.env` and change **all** default credentials:

```bash
# Database -- use strong random passwords
DB_PASSWORD=<random-32-chars>
REDIS_PASSWORD=<random-32-chars>

# JWT -- cryptographically random, minimum 32 characters
JWT_SECRET=<random-64-chars>

# Admin account
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong-password-12-chars-minimum>
ADMIN_EMAIL=admin@yourdomain.com

# Set production mode
APP_ENV=production
```

Generate random secrets:

```bash
openssl rand -base64 48  # For JWT_SECRET
openssl rand -base64 24  # For passwords
```

## 3. Start Services

```bash
make up
# or
docker compose -f docker/docker-compose.yml --env-file .env up -d
```

Verify everything is running:

```bash
docker compose -f docker/docker-compose.yml ps
curl http://localhost/health
```

## 4. HTTPS Setup

### Option A: Tailscale (recommended for remote access)

1. Create an auth key at https://login.tailscale.com/admin/settings/keys
2. Configure in `.env`:

```bash
TS_AUTHKEY=tskey-auth-xxxxx
TS_HOSTNAME=tivify
TS_SERVE_MODE=https
ENABLE_TAILSCALE=true
```

3. Restart services. Access via `https://tivify.<your-tailnet>.ts.net`

### Option B: Let's Encrypt with Certbot

1. Point your domain's DNS to your server
2. Install certbot and obtain certificates
3. Uncomment the HTTPS server block in `nginx/conf.d/default.conf`
4. Update certificate paths and restart nginx

## 5. External Media Library

To import media from external drives:

```bash
# Set the library path in .env
LIBRARY_PATH=/mnt/usb

# The path is mounted read-only into the backend container
# Use the Library Scanner in the admin panel to import
```

## 6. TMDB Metadata Enrichment

Get a free API key from https://www.themoviedb.org/settings/api and set:

```bash
TMDB_API_KEY=your-tmdb-key
```

## 7. IPTV Channel Import

To auto-import channels from an M3U playlist:

```bash
IPTV_M3U_URL=https://iptv-org.github.io/iptv/countries/es.m3u
```

Or import manually via the admin panel at `/admin/iptv`.

## 8. Android APK Distribution

Build the APK (requires Docker):

```bash
cp VERSION android/VERSION
docker build --no-cache -t tivify-android -f android/Dockerfile android/
docker create --name extract tivify-android
docker cp extract:/app/app/build/outputs/apk/debug/app-debug.apk ./tivify.apk
docker rm -f extract
```

Place the APK in the output volume for download via nginx at `/output/tivify.apk`.

## Resource Limits

Default limits in `docker-compose.yml`:

| Service | Memory | CPU |
|---------|--------|-----|
| Backend | 512 MB | 1.0 |
| Frontend | 256 MB | 0.5 |
| Nginx | 256 MB | 1.0 |
| PostgreSQL | 1 GB | -- |
| Redis | 256 MB | -- |

Adjust in `.env` or directly in the compose file for your workload.

## Monitoring

### Logs

```bash
make logs              # All services
make logs-backend      # Backend only
make logs-frontend     # Frontend only
```

### Health Check

```
GET /health
```

Returns 200 if PostgreSQL and Redis are reachable.

### Centralized Logging

Configure syslog forwarding:

```bash
LOG_LEVEL=info
LOG_FORMAT=json
SYSLOG_SERVER=your-syslog-host
SYSLOG_PORT=514
```

## Backups

### PostgreSQL

```bash
# Manual backup
docker exec tivify-postgres pg_dump -U tivify tivify > backup.sql

# Restore
docker exec -i tivify-postgres psql -U tivify tivify < backup.sql
```

### Media Files

Back up the `media_data` Docker volume or the host directory it maps to.

### Full Backup

```bash
# Stop services
make down

# Backup volumes
docker run --rm -v tivify_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data

docker run --rm -v tivify_media_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/media-backup.tar.gz /data

# Restart
make up
```

## Updating

```bash
cd /opt/tivify
git pull
make build
make up
```

The backend runs auto-migrations on startup, so database schema changes are applied automatically.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| 502 Bad Gateway | Backend not started. Check `make logs-backend` |
| CORS errors | Verify `BASE_URL` in `.env` matches your access URL |
| Slow transcoding | Try `FFMPEG_PRESET=ultrafast` or enable `FFMPEG_HWACCEL` |
| Token expired | Check `JWT_EXPIRY` and `REFRESH_TOKEN_EXPIRY` values |
| Media not loading | Verify nginx media path mounts and permissions |
| Database connection refused | Check PostgreSQL logs and `DB_HOST` setting |

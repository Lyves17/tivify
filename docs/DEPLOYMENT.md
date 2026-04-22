# TIVIFY — Deployment Guide

This guide walks through deploying TIVIFY in production, either from source
with `docker compose build`, or from the pre-built images pushed to
`ghcr.io/<owner>/tivify-*` by the [CI/CD pipeline](./CI-CD.md).

- [Architecture at runtime](#architecture-at-runtime)
- [Prerequisites](#prerequisites)
- [Option A — Deploy from source](#option-a--deploy-from-source)
- [Option B — Deploy from GHCR images (recommended)](#option-b--deploy-from-ghcr-images-recommended)
- [Configuration reference](#configuration-reference)
- [HTTPS](#https)
- [External media, TMDB, IPTV](#external-media-tmdb-iptv)
- [Android APK distribution](#android-apk-distribution)
- [Monitoring and logs](#monitoring-and-logs)
- [Backups and disaster recovery](#backups-and-disaster-recovery)
- [Zero-downtime upgrades](#zero-downtime-upgrades)
- [Rolling back](#rolling-back)
- [Staging → production promotion](#staging--production-promotion)
- [Troubleshooting](#troubleshooting)

## Architecture at runtime

```
                  ┌─────────────┐
  client ──HTTPS─▶│   nginx     │──/api──▶ backend (Fiber)
                  │   :80/:443  │──/     ▶ frontend (Next.js)
                  │             │──/media▶ media volume
                  └─────┬───────┘──/live ▶ HLS output volume
                        │
                 Tailscale sidecar
                 (optional)
                        │
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
      postgres        redis      media volumes
```

All services run under a single `docker-compose` project. Data lives in named
Docker volumes (`postgres_data`, `redis_data`, `media_data`, `apk_output`,
`tailscale_data`). The backend runs migrations at startup.

## Prerequisites

- Linux host (Ubuntu 22.04+ or any modern distro)
- Docker Engine 24+ and Docker Compose v2
- 2 vCPU, 2 GB RAM minimum (4 vCPU / 4 GB recommended once transcoding is in
  use)
- Storage sized for your library
- A domain if you want Let's Encrypt, or a Tailscale account for Tailnet HTTPS

## Option A — Deploy from source

Suitable for hacking / single-host production.

```bash
sudo mkdir -p /opt/tivify && sudo chown "$USER" /opt/tivify
git clone <repo-url> /opt/tivify
cd /opt/tivify

cp .env.example .env
# Fill in secrets — see "Configuration reference" below
$EDITOR .env

# Build images locally + start the stack
make build
make up

# Verify
docker compose -f docker/docker-compose.yml ps
curl -fsS http://localhost/health
```

## Option B — Deploy from GHCR images (recommended)

Every successful `release.yml` run publishes multi-arch images to
`ghcr.io/<owner>/tivify-{backend,frontend,nginx}` and attaches a
`tivify-deploy-<version>.tar.gz` bundle to the GitHub Release containing a
compose file and `.env.example`.

### 1. Pull the bundle

```bash
VERSION=2.4.1
mkdir -p /opt/tivify && cd /opt/tivify
curl -L \
  "https://github.com/<owner>/tivify/releases/download/v${VERSION}/tivify-deploy-${VERSION}.tar.gz" \
  | tar xz
cp .env.example .env
$EDITOR .env
```

### 2. Point compose at the registry

Create a compose override that swaps `build:` for `image:` — keep the file
under `/opt/tivify/docker/`:

```yaml
# docker/docker-compose.release.yml
services:
  backend:
    image: ghcr.io/<owner>/tivify-backend:${TIVIFY_VERSION}
    build: !override []
  frontend:
    image: ghcr.io/<owner>/tivify-frontend:${TIVIFY_VERSION}
    build: !override []
  nginx:
    image: ghcr.io/<owner>/tivify-nginx:${TIVIFY_VERSION}
    build: !override []
```

Set the version in `.env`:

```bash
TIVIFY_VERSION=2.4.1
```

### 3. Start

```bash
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.release.yml \
  --env-file .env \
  up -d
```

### 4. Authenticate to GHCR (if the repo is private)

```bash
echo "$GHCR_PAT" | docker login ghcr.io -u <user> --password-stdin
```

## Configuration reference

Edit `.env`. The essentials:

| Variable                  | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `APP_ENV`                 | `production` or `development`. Turns off verbose logging.  |
| `BASE_URL`                | Public URL, e.g. `https://tivify.example.com`.             |
| `DB_PASSWORD`             | **Change** — 32+ random chars. `openssl rand -base64 24`.  |
| `REDIS_PASSWORD`          | **Change** — 32+ random chars.                             |
| `JWT_SECRET`              | **Change** — 64+ random chars. `openssl rand -base64 48`.  |
| `ADMIN_USERNAME`          | First admin user created on startup.                       |
| `ADMIN_PASSWORD`          | **Change** — 12+ chars.                                    |
| `ADMIN_EMAIL`             | Contact email for admin.                                   |
| `LIBRARY_PATH`            | Host path mounted read-only into backend + nginx at `/library`. |
| `MEDIA_PATH`              | Path inside backend for transcoded/HLS output (default `/media`). |
| `TMDB_API_KEY`            | Optional; enables metadata enrichment.                     |
| `IPTV_M3U_URL`            | Optional; auto-seeds channels on first boot.               |
| `SEED_IPTV`               | `true` to run the seeder on first start.                   |
| `CORS_ALLOW_ORIGINS`      | Comma-separated origins. Defaults to `BASE_URL`.           |
| `TS_AUTHKEY`              | Tailscale auth key for the sidecar.                        |
| `TS_HOSTNAME`             | Hostname in your Tailnet (default `tivify`).               |

### Secrets management for larger deploys

For anything beyond a single host, do **not** keep secrets in `.env` on disk.
Options:

- **Docker secrets** (swarm): `docker secret create db_password -` and mount
  at `/run/secrets/*`. The compose file header documents the pattern.
- **Kubernetes**: store the same variables as a `Secret` and project them
  into the pods.
- **HashiCorp Vault / AWS Secrets Manager**: inject at start-up via
  `envconsul` / `aws-vault` or a sidecar.

## HTTPS

### Option 1 — Tailscale (recommended)

```bash
# In .env
TS_AUTHKEY=tskey-auth-xxxxxxxxxxxx
TS_HOSTNAME=tivify
TS_SERVE_MODE=https
```

`docker compose up -d tailscale` will bring up the sidecar, join the
Tailnet and auto-provision an `*.ts.net` cert. The app is reachable at
`https://tivify.<tailnet>.ts.net`.

### Option 2 — Let's Encrypt via Certbot

1. Point DNS `A` / `AAAA` at the host.
2. Install certbot and obtain certs:
   ```bash
   sudo certbot certonly --standalone -d tivify.example.com
   ```
3. Mount `/etc/letsencrypt` into the nginx container (add a volume in a
   compose override) and enable the HTTPS server block in
   `nginx/conf.d/default.conf`.
4. `docker compose restart nginx`.

### Option 3 — Terminate TLS upstream

If you run Cloudflare, an ALB, or Traefik in front, leave nginx on port 80
and terminate TLS on the upstream. Make sure `X-Forwarded-Proto` is
propagated or the generated OAuth / CSRF flows will redirect to HTTP.

## External media, TMDB, IPTV

- **Library**: set `LIBRARY_PATH` to a host path (e.g. `/mnt/usb`). It is
  mounted read-only into `backend` and `nginx` at `/library`. Use the admin
  Library Scanner to index.
- **TMDB**: get a free key at https://www.themoviedb.org/settings/api and
  set `TMDB_API_KEY`. The backend validates it on startup and logs a
  warning otherwise.
- **IPTV**: `IPTV_M3U_URL` + `SEED_IPTV=true` auto-imports on first boot
  when the DB is empty. After that, use the admin panel at `/admin/iptv`.

## Android APK distribution

Automated (recommended): the `build-apk.yml` workflow produces
`tivify-v<version>.apk` and attaches it to every GitHub Release. Users
download directly from the release page.

Manual build — see [`CLAUDE.md`](../CLAUDE.md) for the canonical steps. TL;DR:

```bash
cp VERSION android/VERSION
docker build --no-cache -t tivify-android -f android/Dockerfile android/
docker create --name extract tivify-android
docker cp extract:/app/app/build/outputs/apk/debug/app-debug.apk ./tivify-v$(cat VERSION).apk
docker rm -f extract
```

The nginx container exposes the `apk_output` volume at `/output` if you want
to self-host downloads.

## Monitoring and logs

### Health

```bash
curl -fsS https://tivify.example.com/health     # 200 if DB + Redis are OK
```

The compose file wires a `/health` healthcheck with `start_period` on every
service so `docker compose ps` reflects readiness.

### Logs

```bash
make logs              # all services
make logs-backend
make logs-frontend
make logs-nginx
```

Structured JSON logs are enabled by default. Forward to your log sink:

```bash
LOG_FORMAT=json
SYSLOG_SERVER=your-syslog-host
SYSLOG_PORT=514
```

### Metrics

The backend exposes Prometheus metrics at `/metrics` (protected by the
internal-only middleware — scrape from the Docker network or allow-list
your Prometheus IP).

## Backups and disaster recovery

### PostgreSQL

```bash
# Daily dump → /var/backups/tivify/
docker exec tivify-postgres pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > "/var/backups/tivify/pg-$(date +%F).sql.gz"
```

Restore:

```bash
gunzip -c /var/backups/tivify/pg-YYYY-MM-DD.sql.gz \
  | docker exec -i tivify-postgres psql -U "$DB_USER" "$DB_NAME"
```

### Media volume

```bash
docker run --rm \
  -v tivify_media_data:/data:ro \
  -v /var/backups/tivify:/backup \
  alpine tar czf "/backup/media-$(date +%F).tar.gz" -C /data .
```

### Automated backup cron

Example `/etc/cron.d/tivify-backup`:

```
0 3 * * * root /opt/tivify/scripts/backup.sh >> /var/log/tivify-backup.log 2>&1
```

Create `scripts/backup.sh` with the two commands above and `find
/var/backups/tivify -mtime +14 -delete` to keep 14 days.

### Disaster recovery test

Once a quarter:

1. Spin up a scratch VM with the same compose file.
2. Restore the latest pg dump and media tarball.
3. Boot the stack.
4. Check that the admin panel shows the same content and that a known
   VOD still plays.

## Zero-downtime upgrades

The compose stack is designed for rolling restarts per service:

```bash
cd /opt/tivify
git fetch --tags && git checkout v2.4.1
cp VERSION android/VERSION

# Option A: rebuild from source
docker compose -f docker/docker-compose.yml build backend
docker compose -f docker/docker-compose.yml up -d --no-deps backend

# Option B: pull published image
export TIVIFY_VERSION=2.4.1
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.release.yml \
  pull backend frontend nginx
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.release.yml \
  up -d --no-deps backend frontend nginx
```

The backend runs migrations idempotently on each boot, so the order
(backend → frontend → nginx) is safe; nginx reloads config when restarted.

## Rolling back

Releases are immutable images in GHCR.

```bash
export TIVIFY_VERSION=2.4.0     # previous version
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.release.yml \
  pull
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.release.yml \
  up -d
```

If you need to roll back a DB migration, restore the last dump taken
*before* the upgrade — migrations are forward-only.

## Staging → production promotion

Recommended workflow for teams:

1. Push work to `main`; CI goes green.
2. Tag a release candidate: `git tag -a v2.4.1-rc.1 -m 'rc' && git push --follow-tags`.
3. `release.yml` publishes RC images.
4. Roll RC onto staging (`TIVIFY_VERSION=2.4.1-rc.1`).
5. Smoke test: login, play, transcode, admin flows.
6. Tag `v2.4.1`, promote to production when ready.

## Troubleshooting

| Symptom                           | Likely cause / fix                                               |
| --------------------------------- | ---------------------------------------------------------------- |
| `502 Bad Gateway` on `/api`       | Backend crashed or still starting. `make logs-backend`.          |
| `503` on `/` right after restart  | Frontend healthcheck still warming up; wait `start_period`.      |
| CORS errors in the browser        | `BASE_URL` / `CORS_ALLOW_ORIGINS` in `.env` don't match the URL. |
| Slow transcoding, 100 % CPU       | Set `FFMPEG_PRESET=ultrafast` or enable `FFMPEG_HWACCEL`.        |
| WS disconnects every ~60 s        | Reverse proxy idle-timeout < 60 s. Bump to ≥ 120 s.              |
| `Token expired` loop              | System clock drift between clients and the host.                 |
| `Media not loading`               | Check `LIBRARY_PATH` mount and file permissions.                 |
| `Database connection refused`     | Postgres still starting. Its healthcheck has a 30 s start-period. |
| `PANIC` in ws/hub logs            | Fixed in >=2.4.1 (broadcast recover + graceful Stop).            |
| IPTV seed hangs on shutdown       | Fixed in >=2.4.1 (seeder now honours shutdown context).          |

For anything that looks like a CVE, prefer pulling the latest patch tag
rather than editing containers in place.

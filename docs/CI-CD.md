# TIVIFY — CI/CD

This document describes how the TIVIFY pipeline is wired on GitHub Actions, what
each workflow does, and how to cut a release.

## Overview

```
                   ┌────────────────────┐
   git push  ────▶ │      ci.yml        │  PRs + main
                   │  build / test /    │
                   │  lint / scan       │
                   └──────────┬─────────┘
                              │ green
                              ▼
   git tag v*  ───▶  ┌────────────────────┐
                     │    release.yml     │  tags v*.*.*
                     │  build & push      │
                     │  images → GHCR     │
                     │  attest / scan     │
                     │  deploy bundle     │
                     └──────────┬─────────┘
                                │
                                ▼
                     ┌────────────────────┐
                     │   build-apk.yml    │  tags v*
                     │  assemble APK →    │
                     │  GitHub Release    │
                     └────────────────────┘
```

Continuous security:

- **`codeql.yml`** — SAST on Go, TypeScript and Kotlin on every PR + weekly.
- **`trivy.yml`** — filesystem and Dockerfile/compose misconfig scan on every PR
  + weekly. Release images also get a per-image scan during `release.yml`.
- **`dependabot.yml`** — weekly dependency PRs for Go, npm, Gradle, Docker base
  images and GitHub Actions versions.

## Workflows

### `ci.yml`

Trigger: push to `main`, any PR targeting `main`, manual.

Pipeline (runs in parallel where possible):

| Job       | What it does                                                        |
| --------- | ------------------------------------------------------------------- |
| `changes` | Uses `dorny/paths-filter` so untouched areas are skipped on PRs.    |
| `backend` | `gofmt`, `go vet`, `staticcheck`, `go test -race`, `go build`.      |
| `frontend`| `npm ci`, `npm run lint`, `tsc --noEmit` (CI tsconfig), jest, next build. |
| `android` | `./gradlew lint testDebugUnitTest assembleDebug`. Uploads debug APK.|
| `nginx`   | Builds nginx image and runs `nginx -t` inside it.                   |
| `docker`  | Matrix build (backend/frontend/nginx) via buildx — verifies every Dockerfile. |
| `compose` | Renders `docker-compose.yml` with `.env.example` via `docker compose config`. |
| `ci-summary` | Aggregates the matrix so branch-protection can require a single check. |

> **Tip**: the two pre-existing `TestIPTVSeeder_ImportEPG_{Gzip,MultipleProgrammes}`
> tests are currently skipped via `-skip` in the `backend` job. Remove the skip
> when those fixtures are fixed.

#### Required status check

Configure branch protection on `main` to require **`CI summary`** (the
aggregator job). That single check transitively covers everything.

### `release.yml`

Trigger: tag push matching `v*.*.*`, or manual with a `tag` input.

What it does:

1. **`meta`** — resolves the version from the tag and warns if `VERSION` is out
   of sync.
2. **`images`** — matrix build of `backend`, `frontend`, `nginx` for `amd64`
   and `arm64` using `docker/build-push-action` with GHA cache. Pushes to
   `ghcr.io/<owner>/tivify-<image>` with tags:
   - `<full-semver>` (e.g. `2.4.0`)
   - `<major>.<minor>` (e.g. `2.4`)
   - `<major>` (e.g. `2`)
   - `sha-<short>`
   - `latest`
3. **Attestation** — each image gets a SLSA-style build provenance attestation
   pushed back to the registry via `actions/attest-build-provenance`.
4. **`scan`** — Trivy scans each published image and uploads SARIF to the
   Security tab (non-blocking; the release still ships so hot fixes aren't
   stalled by CVE churn).
5. **`bundle`** — tars `docker/`, `.env.example` and `DEPLOYMENT.md` into
   `tivify-deploy-<version>.tar.gz` and attaches it to the GitHub Release so
   operators can grab a matched pair of compose + docs.

### `build-apk.yml` (existing)

Produces the Android debug APK and attaches it to the GitHub Release on
tag push.

### `codeql.yml`

Go / TypeScript / Kotlin analysis with the `security-extended` and
`security-and-quality` query suites. Runs on PRs, main pushes, and weekly.

### `trivy.yml`

Two jobs:
- **`fs-scan`** — filesystem + dependency scan (npm, go.mod, gradle).
- **`config-scan`** — Dockerfile / compose misconfiguration scan.

Both upload SARIF to the Security tab.

## Cutting a release

### 1. Sync the version files

```bash
# Edit VERSION (semver MAJOR.MINOR.PATCH)
echo "2.4.1" > VERSION

# Bump android/app/build.gradle.kts → versionCode += 1 (manual edit)

# Sync VERSION into android/ for Docker build context
cp VERSION android/VERSION

git add VERSION android/VERSION android/app/build.gradle.kts
git commit -m "release: v2.4.1"
```

### 2. Tag and push

```bash
git tag -a v2.4.1 -m "TIVIFY v2.4.1"
git push origin main --follow-tags
```

`release.yml` and `build-apk.yml` will now run in parallel. Watch the run
from the Actions tab.

### 3. Verify

After the workflows go green:

- `ghcr.io/<owner>/tivify-backend:2.4.1` (and `:latest`, `:2.4`, `:2`) exists
- A GitHub Release `v2.4.1` exists with the APK and the deploy bundle attached
- The Security tab shows up-to-date Trivy + CodeQL results

### 4. Deploy

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for rolling the new images onto staging
and production.

## Required repository settings

**Secrets** — none required for the default flow. `GITHUB_TOKEN` is enough to
push to GHCR and create releases. Optional secrets used by extensions:

| Secret             | Used by                 | Purpose                                 |
| ------------------ | ----------------------- | --------------------------------------- |
| `SSH_DEPLOY_KEY`   | custom deploy job       | SSH into staging / production hosts.    |
| `SLACK_WEBHOOK`    | notifications           | Announce successful releases.           |
| `TAILSCALE_KEY`    | internal runners        | Reach private staging / prod hosts.     |

**Permissions** — set *Settings → Actions → General*:

- Workflow permissions: *Read and write* (required by `release.yml` to publish
  Release assets and GHCR images).
- Fork pull request workflows: *Require approval for first-time contributors*.

**Branch protection on `main`**:

- Require PR before merge
- Require status check: `CI summary`
- Require linear history (recommended)
- Require signed commits (recommended, optional)
- Dismiss stale reviews on new commits

## Local reproduction of CI

Every CI check can be reproduced locally:

```bash
# Backend
cd backend
gofmt -l .
go vet ./...
go test -race -skip 'TestIPTVSeeder_ImportEPG_Gzip|TestIPTVSeeder_ImportEPG_MultipleProgrammes' ./...
go build ./...

# Frontend
cd frontend
npm ci
npm run lint
npx tsc --noEmit -p tsconfig.ci.json
npm test
npm run build

# Android
cd android
cp ../VERSION ./VERSION
./gradlew lint testDebugUnitTest assembleDebug

# Docker
docker build -t tivify-backend-ci  -f backend/Dockerfile  backend/
docker build -t tivify-frontend-ci -f frontend/Dockerfile frontend/
docker build -t tivify-nginx-ci    -f nginx/Dockerfile    nginx/
docker compose -f docker/docker-compose.yml config > /dev/null
```

## Rollback

Releases are immutable — rolling back just means deploying an older tag:

```bash
# On the host
export TIVIFY_VERSION=2.4.0
docker compose -f docker/docker-compose.yml --env-file .env pull
docker compose -f docker/docker-compose.yml --env-file .env up -d
```

If an image was found to be vulnerable after the fact, re-tag on the
operations side rather than deleting the published image (deleting images
breaks attestations and audit trails).

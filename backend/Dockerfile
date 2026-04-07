# Stage 1: Build
# SECURITY: Pinned base image version for reproducible builds
FROM golang:1.22.6-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

COPY . .

ARG APP_VERSION=dev
RUN BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) && \
    GOFLAGS=-mod=mod go build \
      -ldflags "-X github.com/tivify/backend/internal/version.Version=${APP_VERSION} -X github.com/tivify/backend/internal/version.BuildDate=${BUILD_DATE}" \
      -o tivify ./cmd/server/main.go

# Stage 2: Runtime
# SECURITY: Pinned base image version for reproducible builds
FROM alpine:3.19.4

RUN apk add --no-cache ffmpeg ca-certificates tzdata su-exec

# Create non-root user
RUN addgroup -S tivify && adduser -S tivify -G tivify

WORKDIR /app

COPY --from=builder /app/tivify .
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

RUN mkdir -p /media/uploads /media/vod /media/thumbnails /media/logos /media/live /media/channels /media/local && \
    chown -R tivify:tivify /media

EXPOSE 8080

# Entrypoint fixes permissions on mounted volumes then drops to tivify user
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["./tivify"]

#!/bin/sh
# Ensure media directories exist and have correct permissions
# This runs as root before switching to the tivify user
mkdir -p /media/uploads /media/vod /media/thumbnails /media/logos /media/live /media/channels /media/local
chown -R tivify:tivify /media 2>/dev/null || true

# Allow tivify user to access Docker socket (for Tailscale container management)
# On Docker Desktop for Windows, group-based access doesn't work reliably,
# so we open permissions for all users inside this container.
if [ -S /var/run/docker.sock ]; then
    chmod 666 /var/run/docker.sock 2>/dev/null || true
fi

# Switch to non-root user and exec the main process
exec su-exec tivify "$@"

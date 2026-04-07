#!/bin/bash
# build-apk.sh - Builds Android APK following the exact CLAUDE.md procedure
# Usage: ./scripts/build-apk.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Read version
VERSION=$(cat VERSION | tr -d '[:space:]')
echo -e "${GREEN}Building TIVIFY v${VERSION}${NC}"
echo ""

# Step 1: Sync VERSION
echo "Step 1: Syncing VERSION file..."
cp VERSION android/VERSION
echo -e "${GREEN}  VERSION synced to android/${NC}"

# Step 2: Build with --no-cache
echo ""
echo "Step 2: Building Docker image (--no-cache)..."
docker build --no-cache -t tivify-android -f android/Dockerfile android/
echo -e "${GREEN}  Docker image built${NC}"

# Step 3: Extract APK with docker cp
echo ""
echo "Step 3: Extracting APK..."
docker rm -f tivify-extract 2>/dev/null || true
docker create --name tivify-extract tivify-android
docker cp tivify-extract:/app/app/build/outputs/apk/debug/app-debug.apk "./releases/tivify-v${VERSION}.apk"
docker rm -f tivify-extract
echo -e "${GREEN}  APK extracted to releases/tivify-v${VERSION}.apk${NC}"

# Step 4: Verify APK
echo ""
echo "Step 4: Verifying APK..."
docker rm -f verify-apk 2>/dev/null || true
docker create --name verify-apk tivify-android bash -c '/opt/android-sdk/build-tools/35.0.0/aapt dump badging /tmp/app.apk 2>/dev/null | grep -E "versionCode|versionName"; echo "---"; md5sum /tmp/app.apk; md5sum /app/app/build/outputs/apk/debug/app-debug.apk'
docker cp "./releases/tivify-v${VERSION}.apk" verify-apk:/tmp/app.apk
docker start -a verify-apk
docker rm -f verify-apk
echo ""
echo -e "${GREEN}Build complete: releases/tivify-v${VERSION}.apk${NC}"

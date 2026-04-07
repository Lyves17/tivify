# syntax=docker/dockerfile:1
# Requires Docker BuildKit (default in Docker 20+).
# First build:  ~800s  (downloads SDK + Gradle + all deps)
# Warm rebuild: ~60-120s (deps cached by BuildKit, only changed source recompiled)

FROM eclipse-temurin:17-jdk-jammy

ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV GRADLE_HOME=/opt/gradle
# GRADLE_USER_HOME is where Gradle caches downloaded jars/plugins.
# Pointing it to /gradle-cache lets BuildKit persist it between builds.
ENV GRADLE_USER_HOME=/gradle-cache
ENV PATH="${PATH}:${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${GRADLE_HOME}/bin"

# ── Layer 1: system packages (cached; only invalidated if this line changes) ──
RUN apt-get update && apt-get install -y wget unzip && \
    rm -rf /var/lib/apt/lists/*

# ── Layer 2: Android SDK cmdline-tools (cached) ──────────────────────────────
RUN mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/tools.zip && \
    unzip -q /tmp/tools.zip -d ${ANDROID_SDK_ROOT}/cmdline-tools && \
    mv ${ANDROID_SDK_ROOT}/cmdline-tools/cmdline-tools ${ANDROID_SDK_ROOT}/cmdline-tools/latest && \
    rm /tmp/tools.zip

# ── Layer 3: Android platform + build-tools (cached) ─────────────────────────
# Install packages one at a time with retries to avoid corrupt zip downloads
RUN yes | sdkmanager --licenses > /dev/null 2>&1 && \
    for pkg in "platform-tools" "build-tools;34.0.0" "build-tools;35.0.0" "platforms;android-35"; do \
        echo "Installing $pkg ..." && \
        for attempt in 1 2 3; do \
            sdkmanager "$pkg" && break || \
            echo "Retry $attempt for $pkg ..." && sleep 5; \
        done; \
    done

# ── Layer 4: Gradle distribution (cached) ────────────────────────────────────
RUN wget -q https://services.gradle.org/distributions/gradle-8.11.1-bin.zip -O /tmp/gradle.zip && \
    unzip -q /tmp/gradle.zip -d /opt && \
    mv /opt/gradle-8.11.1 ${GRADLE_HOME} && \
    rm /tmp/gradle.zip

WORKDIR /app

# ── Layer 5: dependency pre-fetch (cached when build files are unchanged) ─────
# Copy ONLY the Gradle build scripts – NOT source code.
# Changing a .kt file does NOT invalidate this layer → deps stay cached.
COPY build.gradle.kts settings.gradle.kts gradle.properties* ./
COPY app/build.gradle.kts ./app/

# Minimal source stub so Gradle can walk the dependency graph
RUN mkdir -p app/src/main/java/com/tivify/app \
             app/src/main/res/values \
             app/src/main/res/mipmap-anydpi-v26 && \
    printf 'package com.tivify.app\n' \
        > app/src/main/java/com/tivify/app/Placeholder.kt && \
    printf '<?xml version="1.0" encoding="utf-8"?><resources><string name="app_name">Tivify</string></resources>' \
        > app/src/main/res/values/strings.xml && \
    printf '<?xml version="1.0" encoding="utf-8"?><manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.tivify.app"><application/></manifest>' \
        > app/src/main/AndroidManifest.xml

# Pre-download ALL deps (including aapt2 build tools) using BuildKit persistent cache.
# The /gradle-cache mount persists on the Docker host across builds.
# Removing --configuration filter ensures aapt2 and other detached configs are also resolved.
RUN --mount=type=cache,target=/gradle-cache \
    gradle :app:dependencies \
        --no-daemon -q 2>&1 | grep -v "^[Ww]arning" || true

# ── Layer 6: build with full source ──────────────────────────────────────────
COPY . .

RUN --mount=type=cache,target=/gradle-cache \
    gradle assembleDebug \
        --no-daemon \
        --build-cache \
        --parallel \
        --warning-mode=none

RUN mkdir -p /output
CMD ["cp", "/app/app/build/outputs/apk/debug/app-debug.apk", "/output/tivify.apk"]

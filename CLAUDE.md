# TIVIFY — Instrucciones para Claude

## Generacion de APK Android

**SIEMPRE seguir estos pasos exactos al generar una APK:**

### 1. Sincronizar VERSION
```bash
cp VERSION android/VERSION
```
El archivo `VERSION` esta en la raiz del proyecto. Debe copiarse a `android/` antes de cada build porque el Docker build context es solo `android/`.

### 2. Build con --no-cache
```bash
cd C:\Users\avera\Downloads\TIVIFY
docker build --no-cache -t tivify-android -f android/Dockerfile android/
```
**SIEMPRE usar `--no-cache`** para evitar servir APKs viejas de capas cacheadas.

### 3. Extraer APK con docker cp (NO usar docker run -v)
```bash
docker create --name tivify-extract tivify-android
docker cp tivify-extract:/app/app/build/outputs/apk/debug/app-debug.apk ./tivify-v{VERSION}.apk
docker rm -f tivify-extract
```
**NUNCA usar `docker run -v` para extraer** — los volume mounts de Windows a Linux no funcionan correctamente y entregan APKs viejas.

### 4. Verificar APK
```bash
docker create --name verify-apk tivify-android bash -c '/opt/android-sdk/build-tools/35.0.0/aapt dump badging /tmp/app.apk 2>/dev/null | grep -E "versionCode|versionName"; md5sum /tmp/app.apk; md5sum /app/app/build/outputs/apk/debug/app-debug.apk'
docker cp ./tivify-v{VERSION}.apk verify-apk:/tmp/app.apk
docker start -a verify-apk
docker rm -f verify-apk
```
Verificar que:
- `versionName` coincide con el archivo `VERSION`
- Los checksums md5 del APK extraido y del APK dentro de la imagen son **identicos**

### 5. Entregar
La APK final queda en la raiz del proyecto: `tivify-v{VERSION}.apk`

---

## Incremento de version

Al hacer cambios en la app Android:
1. Actualizar `VERSION` en la raiz (semver: MAJOR.MINOR.PATCH)
2. Incrementar `versionCode` en `android/app/build.gradle.kts` (entero, siempre +1)
3. Copiar VERSION a android/ antes de build

El `build.gradle.kts` lee VERSION desde `../VERSION` (Docker) o `../../VERSION` (local).

---

## Arquitectura

- **Backend:** Go/Fiber, PostgreSQL, Redis
- **Frontend:** Next.js 14
- **Android:** Kotlin + Jetpack Compose + Hilt + ExoPlayer
- **Infra:** Docker Compose (en `docker/`)
- **Proxy:** nginx reverse proxy

## Notas importantes

- `TokenManager.clear()` preserva `SAVED_SERVERS_JSON` y `SAVED_ACCOUNTS_JSON` al limpiar credenciales
- El Docker Compose file esta en `docker/docker-compose.yml` (no en la raiz)
- Para rebuild del backend: `cd docker && docker compose up -d --build backend`

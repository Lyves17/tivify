# TIVIFY - Guia Completa de Migracion y Operacion

## Indice

1. [Requisitos del servidor](#1-requisitos-del-servidor)
2. [Transferir el proyecto](#2-transferir-el-proyecto)
3. [Configuracion de entorno](#3-configuracion-de-entorno)
4. [Arranque completo](#4-arranque-completo)
5. [Verificacion de servicios](#5-verificacion-de-servicios)
6. [Operaciones habituales](#6-operaciones-habituales)
7. [Gestion de la base de datos](#7-gestion-de-la-base-de-datos)
8. [Gestion de media y streaming](#8-gestion-de-media-y-streaming)
9. [Tailscale (acceso remoto)](#9-tailscale-acceso-remoto)
10. [Generar APK Android](#10-generar-apk-android)
11. [Frontend (desarrollo)](#11-frontend-desarrollo)
12. [Backend (desarrollo)](#12-backend-desarrollo)
13. [Tests](#13-tests)
14. [Backups y restauracion](#14-backups-y-restauracion)
15. [Actualizacion de version](#15-actualizacion-de-version)
16. [Troubleshooting](#16-troubleshooting)
17. [Referencia de puertos y volumenes](#17-referencia-de-puertos-y-volumenes)
18. [Estructura de directorios](#18-estructura-de-directorios)

---

## 1. Requisitos del servidor

### Software obligatorio

```bash
# Docker Engine (20.10+)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Docker Compose v2 (viene con Docker Engine moderno)
docker compose version

# Git
sudo apt install -y git
```

### Hardware minimo recomendado

| Recurso | Minimo | Recomendado |
|---------|--------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Disco | 20 GB + media | SSD 50 GB + media |

### Puertos que deben estar abiertos

| Puerto | Servicio |
|--------|----------|
| 80 | HTTP (nginx) |
| 443 | HTTPS (nginx/Tailscale) |

---

## 2. Transferir el proyecto

### Opcion A: Desde Git (recomendado)

```bash
# En el nuevo servidor
cd /opt
git clone <URL_DEL_REPO> TIVIFY
cd TIVIFY
```

### Opcion B: Copiar desde el servidor actual

```bash
# Desde el servidor ACTUAL — comprimir todo excepto node_modules y builds
cd /ruta/al/proyecto
tar czf tivify-backup.tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='frontend/coverage' \
  --exclude='android/.gradle' \
  --exclude='android/app/build' \
  TIVIFY/

# Transferir al nuevo servidor
scp tivify-backup.tar.gz usuario@nuevo-servidor:/opt/

# En el NUEVO servidor
cd /opt
tar xzf tivify-backup.tar.gz
cd TIVIFY
```

### Opcion C: Migrar con datos (DB + media)

```bash
# 1. En el servidor ACTUAL — exportar base de datos
cd /ruta/al/proyecto/docker
docker compose exec postgres pg_dump -U tivify -d tivify | gzip > /tmp/tivify-db.sql.gz

# 2. En el servidor ACTUAL — comprimir media
docker compose cp backend:/media /tmp/tivify-media
tar czf /tmp/tivify-media.tar.gz -C /tmp tivify-media

# 3. Transferir todo al nuevo servidor
scp /tmp/tivify-db.sql.gz usuario@nuevo-servidor:/tmp/
scp /tmp/tivify-media.tar.gz usuario@nuevo-servidor:/tmp/
scp tivify-backup.tar.gz usuario@nuevo-servidor:/opt/

# La restauracion se hace despues del primer arranque (ver seccion 14)
```

---

## 3. Configuracion de entorno

### Crear el archivo .env

```bash
cd /opt/TIVIFY

# Copiar la plantilla
cp .env.example .env

# Editar con tus valores
nano .env
```

### Variables OBLIGATORIAS que debes cambiar

```bash
# ===== SEGURIDAD (CAMBIAR SIEMPRE) =====
DB_PASSWORD=TuPasswordSeguro123!
REDIS_PASSWORD=OtroPasswordSeguro456!
JWT_SECRET=UnaCadenaDeAlMenos32CaracteresAleatorios
ADMIN_PASSWORD=PasswordAdminSeguro789!

# ===== ADMIN (primer arranque) =====
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@tudominio.com

# ===== BASE DE DATOS =====
DB_USER=tivify
DB_NAME=tivify
DB_HOST=postgres
DB_PORT=5432
DB_SSLMODE=disable

# ===== REDIS =====
REDIS_HOST=redis
REDIS_PORT=6379

# ===== APLICACION =====
APP_ENV=production
APP_PORT=8080

# ===== FRONTEND =====
# Cambia localhost por la IP o dominio del nuevo servidor
NEXT_PUBLIC_API_URL=http://TU_IP_O_DOMINIO/api
NEXT_PUBLIC_STREAM_URL=http://TU_IP_O_DOMINIO

# ===== MEDIA =====
MEDIA_PATH=/media
FFMPEG_PATH=/usr/bin/ffmpeg
FFMPEG_PRESET=faster
FFMPEG_AUDIO_BITRATE=192k
FFMPEG_HWACCEL=none

# ===== BIBLIOTECA LOCAL (ruta a disco externo o NAS) =====
LIBRARY_PATH=/mnt/usb

# ===== TMDB (opcional, para metadatos de peliculas) =====
TMDB_API_KEY=tu_api_key_de_themoviedb

# ===== TAILSCALE (opcional, acceso remoto) =====
ENABLE_TAILSCALE=true
TS_AUTHKEY=tskey-auth-xxxxxxxxxxxx
TS_HOSTNAME=tivify
TS_SERVE_MODE=https
```

### Generar valores seguros automaticamente

```bash
# Generar JWT_SECRET (64 caracteres aleatorios)
openssl rand -base64 48

# Generar DB_PASSWORD
openssl rand -base64 24

# Generar REDIS_PASSWORD
openssl rand -base64 24
```

### Validar configuracion

```bash
chmod +x scripts/validate-env.sh
./scripts/validate-env.sh
```

---

## 4. Arranque completo

### Primer arranque (build + start)

```bash
cd /opt/TIVIFY/docker

# Construir todas las imagenes y arrancar
docker compose up -d --build

# Ver logs en tiempo real (Ctrl+C para salir sin parar servicios)
docker compose logs -f
```

Esto arranca 6 servicios en orden:
1. **postgres** — Base de datos PostgreSQL 16
2. **redis** — Cache Redis 7
3. **backend** — API Go/Fiber (espera a postgres y redis)
4. **frontend** — Web Next.js 14 (espera al backend)
5. **nginx** — Proxy inverso (espera a backend y frontend)
6. **tailscale** — VPN acceso remoto (espera a nginx)

### Verificar que todo arranco

```bash
docker compose ps
```

Todos los servicios deben estar en estado `Up (healthy)`:

```
NAME                STATUS
tivify-postgres     Up (healthy)
tivify-redis        Up (healthy)
tivify-backend      Up (healthy)
tivify-frontend     Up (healthy)
tivify-nginx        Up (healthy)
tivify-tailscale    Up
```

### Arranque solo en desarrollo (sin backend/frontend/nginx)

```bash
cd /opt/TIVIFY/docker
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Esto solo arranca postgres y redis con puertos expuestos al host.

---

## 5. Verificacion de servicios

### Comprobar salud de cada servicio

```bash
# Backend health
curl -s http://localhost/api/health | jq .

# Frontend
curl -s -o /dev/null -w "%{http_code}" http://localhost/

# PostgreSQL
docker compose exec postgres pg_isready -U tivify

# Redis
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" ping

# Nginx
curl -s -o /dev/null -w "%{http_code}" http://localhost/
```

### Ver logs de cada servicio

```bash
# Todos los servicios
docker compose logs -f

# Servicio especifico
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx
docker compose logs -f postgres
docker compose logs -f redis
docker compose logs -f tailscale

# Ultimas 100 lineas
docker compose logs --tail=100 backend
```

### Acceder a la aplicacion

```
Web:      http://TU_IP_O_DOMINIO/
Login:    http://TU_IP_O_DOMINIO/login
Admin:    http://TU_IP_O_DOMINIO/admin
API:      http://TU_IP_O_DOMINIO/api/health
```

Usuario por defecto: el que configuraste en `ADMIN_USERNAME` / `ADMIN_PASSWORD`

---

## 6. Operaciones habituales

### Parar todo

```bash
cd /opt/TIVIFY/docker
docker compose down
```

### Parar todo Y borrar datos (DESTRUCTIVO)

```bash
# Borra volumenes de datos (DB, Redis, media)
docker compose down -v
```

### Reiniciar un servicio especifico

```bash
docker compose restart backend
docker compose restart frontend
docker compose restart nginx
```

### Rebuild de un servicio (tras cambios en codigo)

```bash
# Solo el backend
docker compose up -d --build backend

# Solo el frontend
docker compose up -d --build frontend

# Solo nginx (tras cambios en config)
docker compose up -d --build nginx

# Todos
docker compose up -d --build
```

### Ver uso de recursos

```bash
docker stats --no-stream
```

### Entrar a un contenedor

```bash
# Shell en el backend
docker compose exec backend sh

# Shell en postgres
docker compose exec postgres psql -U tivify -d tivify

# Shell en redis
docker compose exec redis redis-cli -a "$REDIS_PASSWORD"
```

### Reiniciar todo limpio (sin perder datos)

```bash
cd /opt/TIVIFY/docker
docker compose down
docker compose up -d --build
```

---

## 7. Gestion de la base de datos

### Conectar a PostgreSQL

```bash
# Desde dentro del contenedor
docker compose exec postgres psql -U tivify -d tivify

# Desde el host (si expones el puerto en dev)
psql -h localhost -p 5432 -U tivify -d tivify
```

### Consultas utiles

```sql
-- Ver todas las tablas
\dt

-- Contar usuarios
SELECT COUNT(*) FROM users;

-- Ver canales
SELECT id, name, channel_number FROM channels ORDER BY channel_number;

-- Ver categorias
SELECT id, name, type FROM categories;

-- Ver VODs
SELECT id, title, status FROM vods LIMIT 20;

-- Ver series
SELECT id, title, total_seasons FROM series LIMIT 20;

-- Ver sesiones activas
SELECT id, user_id, expires_at FROM sessions WHERE expires_at > NOW();

-- Ver historial reciente
SELECT * FROM watch_histories ORDER BY watched_at DESC LIMIT 10;

-- Espacio en disco por tabla
SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename::text))
FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(tablename::text) DESC;
```

### Migraciones

Las migraciones se ejecutan automaticamente al arrancar el backend. No se requiere accion manual. GORM AutoMigrate crea/altera tablas segun los modelos.

---

## 8. Gestion de media y streaming

### Estructura de archivos de media

```
/media/                     (volumen Docker: media_data)
  uploads/                  Archivos subidos (pre-transcodificacion)
  vod/                      HLS transcodificado (.m3u8 + .ts)
  thumbnails/               Miniaturas de video
  logos/                    Logos de canales y categorias
  live/                     Emisiones en vivo (HLS temporal)
  channels/                 Metadatos de canales
  local/                    Media local importado
```

### Importar canales IPTV

```
1. Ir a Admin > IPTV
2. Pegar URL de la lista M3U/M3U8
3. Seleccionar filtros (opcional)
4. Click "Importar"
```

O via API:
```bash
TOKEN=$(curl -s -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"TuPassword"}' | jq -r '.data.access_token')

curl -X POST http://localhost/api/v1/admin/iptv/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"http://tu-proveedor.com/lista.m3u"}'
```

### Importar EPG (guia de programacion)

```
1. Ir a Admin > EPG
2. Pegar URL del XMLTV
3. Click "Importar"
```

### Subir VOD (pelicula/video)

```
1. Ir a Admin > VOD
2. Click "Nuevo VOD"
3. Rellenar metadatos (titulo, descripcion, categoria)
4. Subir archivo de video
5. El backend transcodifica automaticamente a HLS
```

### Escanear biblioteca local

```
1. Ir a Admin > Biblioteca
2. Click "Escanear"
3. Los archivos de LIBRARY_PATH se indexan automaticamente
4. Asociar metadatos TMDB desde la interfaz
```

### Verificar almacenamiento de media

```bash
# Ver espacio usado por el volumen de media
docker compose exec backend du -sh /media/*

# Ver espacio total del volumen
docker system df -v | grep media
```

### Emisiones en vivo (Live Streaming)

```
1. Admin > Canales > Editar canal
2. Pestana "Emision Local"
3. Seleccionar archivo de media local
4. Click "Iniciar Emision"
5. El backend usa FFmpeg para generar HLS en tiempo real
```

---

## 9. Tailscale (acceso remoto)

### Configuracion inicial

1. Crear cuenta en [login.tailscale.com](https://login.tailscale.com)
2. Generar auth key: Settings > Keys > Generate auth key
   - Tipo: **Ephemeral** (recomendado)
   - Expiracion: 1 dia
3. Configurar en `.env`:

```bash
ENABLE_TAILSCALE=true
TS_AUTHKEY=tskey-auth-xxxxxxxxxxxx
TS_HOSTNAME=tivify
TS_SERVE_MODE=https
```

4. Reiniciar:

```bash
cd /opt/TIVIFY/docker
docker compose up -d tailscale
```

### Verificar conexion

```bash
# Ver estado de Tailscale
docker compose exec tailscale tailscale status

# Ver URL asignada
docker compose logs tailscale | grep "Available at"
```

La app sera accesible en: `https://tivify.<tu-tailnet>.ts.net`

### Renovar auth key

```bash
# Generar nueva key en login.tailscale.com
# Actualizar .env con la nueva TS_AUTHKEY
# Reiniciar solo tailscale
docker compose restart tailscale
```

### Desactivar Tailscale

```bash
# En .env: ENABLE_TAILSCALE=false
docker compose stop tailscale
```

---

## 10. Generar APK Android

### Proceso completo

```bash
cd /opt/TIVIFY

# 1. Sincronizar VERSION
cp VERSION android/VERSION

# 2. Verificar version actual
cat VERSION
# Output: 2.4.0

# 3. Build con Docker (--no-cache SIEMPRE)
docker build --no-cache -t tivify-android -f android/Dockerfile android/

# 4. Extraer APK (NUNCA usar docker run -v en Windows)
docker create --name tivify-extract tivify-android
VERSION=$(cat VERSION)
docker cp tivify-extract:/app/app/build/outputs/apk/debug/app-debug.apk ./tivify-v${VERSION}.apk
docker rm -f tivify-extract

# 5. Verificar APK
docker create --name verify-apk tivify-android
docker cp ./tivify-v${VERSION}.apk verify-apk:/tmp/app.apk
docker start -a verify-apk
docker rm -f verify-apk

# 6. El APK queda en: ./tivify-v2.4.0.apk
ls -la tivify-v*.apk
```

### Distribuir APK via la propia app

Si `ENABLE_APK_DOWNLOAD=true` en `.env`, la APK se sirve automaticamente en:

```
http://TU_IP_O_DOMINIO/tivify.apk
```

El volumen `apk_output` se comparte entre el build de Android y nginx.

### Build con Docker Compose (alternativa)

```bash
cd /opt/TIVIFY/docker
docker compose --profile build-apk up android-build
```

---

## 11. Frontend (desarrollo)

### Setup local

```bash
cd /opt/TIVIFY/frontend

# Instalar dependencias
npm install

# Crear .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost/api
NEXT_PUBLIC_STREAM_URL=http://localhost
NEXT_PUBLIC_APP_VERSION=2.4.0
EOF

# Arrancar en modo desarrollo
npm run dev
# Disponible en http://localhost:3000

# Build de produccion
npm run build

# Arrancar build de produccion
npm start
```

### Estructura de paginas

```
src/app/
  (auth)/login/          Login de usuario
  (user)/
    home/                Dashboard del usuario
    channels/            Lista de canales en vivo
    channels/[id]/       Reproductor de canal
    vod/                 Catalogo de peliculas
    vod/[id]/            Reproductor de VOD
    series/              Catalogo de series
    series/[id]/         Detalle de serie + episodios
    favorites/           Favoritos del usuario
    history/             Historial de reproduccion
    guide/               Guia de programacion (EPG)
    settings/            Ajustes de usuario
    help/                Ayuda
  admin/
    (dashboard)          Estadisticas generales
    channels/            CRUD canales + streams + emisiones
    iptv/                Importar listas M3U
    vod/                 CRUD peliculas + transcodificacion
    series/              CRUD series + temporadas + episodios
    categories/          CRUD categorias
    library/             Escaneo de biblioteca + TMDB
    epg/                 Importar guia XMLTV
    users/               Gestion de usuarios
    tailscale/           Estado de Tailscale
```

---

## 12. Backend (desarrollo)

### Setup local (requiere Docker para Go)

```bash
# El backend se ejecuta siempre en Docker (Go no se instala localmente)

# Rebuild solo el backend
cd /opt/TIVIFY/docker
docker compose up -d --build backend

# Ver logs del backend
docker compose logs -f backend
```

### API principal — Endpoints

```
# ===== AUTENTICACION =====
POST   /api/v1/auth/login          Login (username + password)
POST   /api/v1/auth/refresh        Refresh token (cookie)
POST   /api/v1/auth/logout         Logout
GET    /api/v1/auth/me             Usuario actual

# ===== CONTENIDO (usuario) =====
GET    /api/v1/channels             Lista de canales
GET    /api/v1/channels/:id         Detalle de canal
GET    /api/v1/vod                  Lista de VODs
GET    /api/v1/vod/:id              Detalle de VOD
GET    /api/v1/series               Lista de series
GET    /api/v1/series/:id           Detalle de serie
GET    /api/v1/categories           Categorias
GET    /api/v1/epg                  Guia EPG
GET    /api/v1/search               Busqueda full-text

# ===== FAVORITOS Y HISTORIAL =====
GET    /api/v1/favorites            Listar favoritos
POST   /api/v1/favorites/toggle     Agregar/quitar favorito
GET    /api/v1/history              Historial
POST   /api/v1/history              Registrar reproduccion
DELETE /api/v1/history/:id          Borrar entrada

# ===== EMISIONES =====
GET    /api/v1/emissions/live       Canales emitiendo en vivo

# ===== ADMIN =====
GET    /api/v1/admin/dashboard/stats   Estadisticas del dashboard

# ===== ADMIN: CANALES =====
GET    /api/v1/admin/channels          Lista
POST   /api/v1/admin/channels          Crear
PUT    /api/v1/admin/channels/:id      Actualizar
DELETE /api/v1/admin/channels/:id      Eliminar

# ===== ADMIN: STREAMS =====
POST   /api/v1/admin/streams           Crear stream
PUT    /api/v1/admin/streams/:id       Actualizar
DELETE /api/v1/admin/streams/:id       Eliminar

# ===== ADMIN: EMISIONES =====
POST   /api/v1/admin/emissions/start   Iniciar emision
POST   /api/v1/admin/emissions/stop    Detener emision
GET    /api/v1/admin/emissions/status/:id  Estado de emision

# ===== ADMIN: VOD =====
GET    /api/v1/admin/vods              Lista
POST   /api/v1/admin/vods              Crear
PUT    /api/v1/admin/vods/:id          Actualizar
DELETE /api/v1/admin/vods/:id          Eliminar
POST   /api/v1/admin/media/upload      Subir video (multipart)
GET    /api/v1/admin/media/progress/:id  Progreso transcodificacion

# ===== ADMIN: SERIES =====
GET    /api/v1/admin/series            Lista
POST   /api/v1/admin/series            Crear
PUT    /api/v1/admin/series/:id        Actualizar
DELETE /api/v1/admin/series/:id        Eliminar

# ===== ADMIN: CATEGORIAS =====
GET    /api/v1/admin/categories        Lista
POST   /api/v1/admin/categories        Crear
PUT    /api/v1/admin/categories/:id    Actualizar
DELETE /api/v1/admin/categories/:id    Eliminar

# ===== ADMIN: USUARIOS =====
GET    /api/v1/admin/users             Lista
POST   /api/v1/admin/users             Crear
PUT    /api/v1/admin/users/:id         Actualizar
DELETE /api/v1/admin/users/:id         Eliminar

# ===== ADMIN: IPTV =====
POST   /api/v1/admin/iptv/import       Importar M3U
GET    /api/v1/admin/iptv/status       Estado importacion

# ===== ADMIN: EPG =====
POST   /api/v1/admin/epg/import        Importar XMLTV
GET    /api/v1/admin/epg/entries        Lista entradas

# ===== ADMIN: BIBLIOTECA =====
POST   /api/v1/admin/library/scan      Escanear
GET    /api/v1/admin/library/items      Items escaneados
GET    /api/v1/admin/library/devices    Dispositivos/discos
GET    /api/v1/admin/tmdb/status        Estado API TMDB
GET    /api/v1/admin/tmdb/search        Buscar en TMDB

# ===== XTREAM CODES (compatibilidad) =====
GET    /player_api.php                  API Xtream Codes
GET    /xmltv.php                       EPG Xtream
GET    /get.php                         Stream Xtream
GET    /live/:user/:pass/:id            Stream live
GET    /movie/:user/:pass/:id           Stream pelicula
GET    /series/:user/:pass/:id          Stream serie

# ===== WEBSOCKET =====
WS     /ws?token=JWT                    Eventos en tiempo real

# ===== METRICAS =====
GET    /metrics                         Prometheus metrics
```

---

## 13. Tests

### Frontend (Jest + React Testing Library)

```bash
cd /opt/TIVIFY/frontend

# Ejecutar todos los tests
npx jest

# Con cobertura
npx jest --coverage

# Solo un archivo
npx jest __tests__/pages/admin/channels.test.tsx

# Watch mode
npx jest --watch
```

**Cobertura actual: 99.08% lineas, 97.74% statements, 88 suites, 1434 tests**

### Backend (Go tests via Docker)

```bash
cd /opt/TIVIFY

# Ejecutar todos los tests del backend
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/app" -w /app/backend golang:1.22 go test ./...

# Con cobertura
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/app" -w /app/backend golang:1.22 \
  go test -coverprofile=coverage.out ./...

# Ver reporte de cobertura
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/app" -w /app/backend golang:1.22 \
  go tool cover -func=coverage.out
```

---

## 14. Backups y restauracion

### Backup de base de datos

```bash
cd /opt/TIVIFY/docker

# Backup manual
docker compose exec postgres pg_dump -U tivify -d tivify | gzip > ../backups/tivify-$(date +%Y%m%d-%H%M%S).sql.gz

# Backup con script incluido
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
```

### Backup automatico (cron)

```bash
# Editar crontab
crontab -e

# Agregar backup diario a las 2:00 AM
0 2 * * * cd /opt/TIVIFY/docker && docker compose exec -T postgres pg_dump -U tivify -d tivify | gzip > /opt/TIVIFY/backups/tivify-$(date +\%Y\%m\%d).sql.gz
```

### Backup de media

```bash
# Copiar volumen de media
docker run --rm -v tivify_media_data:/media -v /opt/backups:/backup alpine \
  tar czf /backup/media-$(date +%Y%m%d).tar.gz -C /media .
```

### Restaurar base de datos

```bash
cd /opt/TIVIFY/docker

# Asegurar que postgres esta corriendo
docker compose up -d postgres

# Restaurar
gunzip -c ../backups/tivify-20240115.sql.gz | \
  docker compose exec -T postgres psql -U tivify -d tivify

# Si la DB existe y quieres reemplazarla completamente:
docker compose exec postgres dropdb -U tivify tivify
docker compose exec postgres createdb -U tivify tivify
gunzip -c ../backups/tivify-20240115.sql.gz | \
  docker compose exec -T postgres psql -U tivify -d tivify
```

### Restaurar media

```bash
docker run --rm -v tivify_media_data:/media -v /opt/backups:/backup alpine \
  sh -c "cd /media && tar xzf /backup/media-20240115.tar.gz"
```

### Backup completo (DB + media + config)

```bash
#!/bin/bash
BACKUP_DIR=/opt/backups/tivify-$(date +%Y%m%d)
mkdir -p $BACKUP_DIR

# 1. Base de datos
cd /opt/TIVIFY/docker
docker compose exec -T postgres pg_dump -U tivify -d tivify | gzip > $BACKUP_DIR/db.sql.gz

# 2. Media
docker run --rm -v tivify_media_data:/media -v $BACKUP_DIR:/backup alpine \
  tar czf /backup/media.tar.gz -C /media .

# 3. Configuracion
cp /opt/TIVIFY/.env $BACKUP_DIR/env.backup
cp /opt/TIVIFY/VERSION $BACKUP_DIR/

echo "Backup completo en: $BACKUP_DIR"
ls -lh $BACKUP_DIR/
```

---

## 15. Actualizacion de version

### Proceso de actualizacion

```bash
cd /opt/TIVIFY

# 1. Actualizar el codigo
git pull origin main

# 2. Verificar nueva version
cat VERSION

# 3. Rebuild y reiniciar
cd docker
docker compose down
docker compose up -d --build

# 4. Verificar salud
docker compose ps
curl -s http://localhost/api/health
```

### Incremento de version (para desarrolladores)

```bash
# 1. Editar VERSION (semver: MAJOR.MINOR.PATCH)
echo "2.5.0" > VERSION

# 2. Incrementar versionCode en Android (siempre +1)
# Editar android/app/build.gradle.kts: versionCode = 7

# 3. Copiar VERSION para Android build
cp VERSION android/VERSION

# 4. Rebuild
cd docker
docker compose up -d --build
```

---

## 16. Troubleshooting

### El backend no arranca

```bash
# Ver logs
docker compose logs backend

# Problemas comunes:
# - PostgreSQL no esta listo: esperar o verificar healthcheck
# - Variables de entorno faltantes: ejecutar scripts/validate-env.sh
# - Puerto 8080 ocupado: verificar con 'ss -tlnp | grep 8080'
```

### La web no carga

```bash
# Verificar nginx
docker compose logs nginx

# Verificar frontend
docker compose logs frontend

# Verificar que los servicios upstream estan corriendo
docker compose ps

# Probar backend directamente
docker compose exec nginx wget -qO- http://backend:8080/health
```

### Error de conexion a base de datos

```bash
# Verificar que postgres esta corriendo
docker compose ps postgres

# Probar conexion
docker compose exec postgres pg_isready -U tivify

# Ver logs de postgres
docker compose logs postgres

# Verificar variables de entorno
docker compose exec backend env | grep DB_
```

### Media no se reproduce

```bash
# Verificar permisos del directorio media
docker compose exec backend ls -la /media/

# Verificar que nginx puede acceder
docker compose exec nginx ls -la /media/

# Verificar logs de nginx para errores 403/404
docker compose logs nginx | grep -E "403|404"
```

### Transcodificacion falla

```bash
# Verificar ffmpeg
docker compose exec backend ffmpeg -version

# Ver logs del proceso de transcodificacion
docker compose logs backend | grep -i "transcode\|ffmpeg"
```

### Limpiar todo y empezar de cero

```bash
cd /opt/TIVIFY/docker

# Parar todo
docker compose down

# Borrar volumenes (DESTRUYE TODOS LOS DATOS)
docker compose down -v

# Borrar imagenes construidas
docker compose down --rmi local

# Limpiar cache de Docker
docker system prune -af

# Reconstruir todo desde cero
docker compose up -d --build
```

---

## 17. Referencia de puertos y volumenes

### Puertos internos (Docker network)

| Servicio | Puerto | Protocolo |
|----------|--------|-----------|
| PostgreSQL | 5432 | TCP |
| Redis | 6379 | TCP |
| Backend | 8080 | HTTP |
| Frontend | 3000 | HTTP |
| Nginx | 80, 443 | HTTP/HTTPS |

### Puertos expuestos al host

| Puerto | Servicio | Notas |
|--------|----------|-------|
| 80 | Nginx | HTTP principal |
| 443 | Nginx | HTTPS (Tailscale) |
| 5432 | PostgreSQL | Solo en modo dev |
| 6379 | Redis | Solo en modo dev |

### Volumenes Docker

| Volumen | Contenido | Importante |
|---------|-----------|------------|
| `postgres_data` | Base de datos PostgreSQL | **BACKUP CRITICO** |
| `redis_data` | Cache Redis | Regenerable |
| `media_data` | Videos, HLS, thumbnails, logos | **BACKUP CRITICO** |
| `tailscale_data` | Estado de Tailscale | Regenerable |
| `apk_output` | APK compilada | Regenerable |
| `gradle_cache` | Cache de compilacion Android | Regenerable |

---

## 18. Estructura de directorios

```
TIVIFY/
├── VERSION                 Version semantica (2.4.0)
├── .env                    Variables de entorno (NO commitear)
├── .env.example            Plantilla de variables
├── Makefile                Comandos de desarrollo
├── CLAUDE.md               Instrucciones para Claude AI
├── GUIA-MIGRACION.md       Este archivo
│
├── backend/                API Go/Fiber
│   ├── Dockerfile
│   ├── go.mod / go.sum
│   ├── entrypoint.sh
│   ├── cmd/server/main.go  Punto de entrada
│   └── internal/           Logica de negocio
│       ├── config/         Carga de variables de entorno
│       ├── database/       Conexion PostgreSQL + Redis
│       ├── model/          16 modelos GORM (tablas)
│       ├── repository/     Capa de acceso a datos
│       ├── service/        Logica de negocio
│       ├── handler/        Controladores HTTP
│       ├── middleware/      Auth JWT, CORS, rate limit
│       ├── router/         Definicion de rutas
│       ├── cache/          Wrapper Redis
│       ├── ws/             WebSocket tiempo real
│       └── metrics/        Prometheus
│
├── frontend/               Web Next.js 14
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── src/app/            Paginas (App Router)
│   ├── src/components/     Componentes UI
│   ├── src/context/        Auth + Toast providers
│   └── src/lib/            API client, utils, i18n
│
├── android/                App Android Kotlin
│   ├── Dockerfile
│   ├── VERSION             (copia de la raiz)
│   ├── app/
│   │   ├── build.gradle.kts
│   │   └── src/main/java/com/tivify/app/
│   └── build.gradle.kts
│
├── docker/                 Infraestructura Docker
│   ├── docker-compose.yml      Produccion (8 servicios)
│   ├── docker-compose.dev.yml  Desarrollo (solo DB+Redis)
│   ├── postgres/init.sql       Init de PostgreSQL
│   ├── tailscale/              Config Tailscale
│   └── scripts/backup-db.sh   Script de backup
│
├── nginx/                  Proxy inverso
│   ├── Dockerfile
│   ├── nginx.conf
│   └── conf.d/default.conf    Rutas y seguridad
│
├── scripts/                Automatizacion
│   ├── build-apk.sh        Build de APK Android
│   └── validate-env.sh     Validacion de .env
│
└── docs/                   Documentacion
    ├── ARCHITECTURE.md
    ├── DEPLOYMENT.md
    ├── DEVELOPMENT.md
    ├── API.md
    └── ANDROID.md
```

---

## Resumen rapido: Arrancar en un servidor nuevo

```bash
# 1. Instalar Docker
curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER

# 2. Clonar/copiar proyecto
cd /opt && git clone <REPO_URL> TIVIFY && cd TIVIFY

# 3. Configurar
cp .env.example .env && nano .env   # Cambiar passwords y URLs

# 4. Arrancar
cd docker && docker compose up -d --build

# 5. Verificar
docker compose ps
curl http://localhost/api/health

# 6. Acceder
# Web: http://TU_IP/
# Admin: http://TU_IP/admin
# Login: admin / (password que pusiste en .env)
```

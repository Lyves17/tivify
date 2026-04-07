#!/usr/bin/env python3
"""Generate TIVIFY Complete Manual PDF."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, HRFlowable, ListFlowable, ListItem
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.fonts import addMapping
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# --- Colors ---
PRIMARY = HexColor('#1e40af')  # Blue 800
SECONDARY = HexColor('#3b82f6')  # Blue 500
ACCENT = HexColor('#059669')  # Emerald 600
DARK = HexColor('#1e293b')  # Slate 800
LIGHT_BG = HexColor('#f1f5f9')  # Slate 100
CODE_BG = HexColor('#1e293b')
BORDER = HexColor('#cbd5e1')  # Slate 300
WARNING_BG = HexColor('#fef3c7')
WARNING_BORDER = HexColor('#f59e0b')

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'TIVIFY-Manual-Completo.pdf')

# --- Styles ---
styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    'CoverTitle', parent=styles['Title'],
    fontSize=42, leading=50, textColor=white,
    alignment=TA_CENTER, spaceAfter=20
))
styles.add(ParagraphStyle(
    'CoverSubtitle', parent=styles['Normal'],
    fontSize=18, leading=24, textColor=HexColor('#93c5fd'),
    alignment=TA_CENTER, spaceAfter=10
))
styles.add(ParagraphStyle(
    'CoverVersion', parent=styles['Normal'],
    fontSize=14, leading=18, textColor=HexColor('#cbd5e1'),
    alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'ChapterTitle', parent=styles['Heading1'],
    fontSize=26, leading=32, textColor=PRIMARY,
    spaceBefore=30, spaceAfter=16,
    borderWidth=2, borderColor=PRIMARY, borderPadding=8
))
styles.add(ParagraphStyle(
    'SectionTitle', parent=styles['Heading2'],
    fontSize=18, leading=22, textColor=DARK,
    spaceBefore=20, spaceAfter=10
))
styles.add(ParagraphStyle(
    'SubSection', parent=styles['Heading3'],
    fontSize=14, leading=18, textColor=SECONDARY,
    spaceBefore=14, spaceAfter=8
))
styles['BodyText'].fontSize = 10
styles['BodyText'].leading = 14
styles['BodyText'].textColor = DARK
styles['BodyText'].alignment = TA_JUSTIFY
styles['BodyText'].spaceAfter = 6
styles.add(ParagraphStyle(
    'CodeBlock', parent=styles['Normal'],
    fontSize=8.5, leading=11, fontName='Courier',
    textColor=HexColor('#e2e8f0'), backColor=CODE_BG,
    borderWidth=1, borderColor=HexColor('#334155'),
    borderPadding=8, spaceAfter=10, spaceBefore=6,
    leftIndent=10, rightIndent=10
))
styles.add(ParagraphStyle(
    'InlineCode', parent=styles['Normal'],
    fontSize=9, fontName='Courier', textColor=PRIMARY,
    backColor=LIGHT_BG
))
styles.add(ParagraphStyle(
    'Warning', parent=styles['Normal'],
    fontSize=10, leading=14, textColor=HexColor('#92400e'),
    backColor=WARNING_BG, borderWidth=1, borderColor=WARNING_BORDER,
    borderPadding=8, spaceAfter=10, spaceBefore=6,
    leftIndent=10, rightIndent=10
))
styles.add(ParagraphStyle(
    'TableHeader', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=white,
    fontName='Helvetica-Bold', alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'TableCell', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=DARK,
    alignment=TA_LEFT
))
styles.add(ParagraphStyle(
    'TableCellCenter', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=DARK,
    alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'BulletText', parent=styles['Normal'],
    fontSize=10, leading=14, textColor=DARK,
    spaceAfter=4, leftIndent=20, bulletIndent=10
))
styles.add(ParagraphStyle(
    'TOCEntry', parent=styles['Normal'],
    fontSize=12, leading=18, textColor=DARK,
    spaceAfter=4, leftIndent=20
))
styles.add(ParagraphStyle(
    'TOCChapter', parent=styles['Normal'],
    fontSize=14, leading=20, textColor=PRIMARY,
    fontName='Helvetica-Bold', spaceAfter=4, spaceBefore=10
))

# --- Helpers ---
def code(text):
    """Create a code block."""
    escaped = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return Paragraph(escaped, styles['CodeBlock'])

def body(text):
    return Paragraph(text, styles['BodyText'])

def bullet(text):
    return Paragraph(f"<bullet>&bull;</bullet> {text}", styles['BulletText'])

def warning(text):
    return Paragraph(f"<b>IMPORTANTE:</b> {text}", styles['Warning'])

def chapter(text):
    return Paragraph(text, styles['ChapterTitle'])

def section(text):
    return Paragraph(text, styles['SectionTitle'])

def subsection(text):
    return Paragraph(text, styles['SubSection'])

def spacer(h=10):
    return Spacer(1, h)

def hr():
    return HRFlowable(width="100%", thickness=1, color=BORDER, spaceBefore=10, spaceAfter=10)

def make_table(headers, rows, col_widths=None):
    """Create a styled table."""
    header_row = [Paragraph(h, styles['TableHeader']) for h in headers]
    data = [header_row]
    for row in rows:
        data.append([Paragraph(str(c), styles['TableCell']) for c in row])

    if col_widths is None:
        col_widths = [None] * len(headers)

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, LIGHT_BG]),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
    ]))
    return t


def build_cover():
    """Build the cover page."""
    elements = []
    # Background table for cover
    cover_data = [['']]
    cover_table = Table(cover_data, colWidths=[19*cm], rowHeights=[26*cm])
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), PRIMARY),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))

    elements.append(spacer(40))
    # Title block with background
    title_data = [
        [Paragraph('TIVIFY', styles['CoverTitle'])],
        [Paragraph('Manual Completo de Desarrollo y Operaciones', styles['CoverSubtitle'])],
        [spacer(20)],
        [Paragraph('Version 2.4.0', styles['CoverVersion'])],
        [spacer(10)],
        [Paragraph('Plataforma IPTV/OTT Self-Hosted', styles['CoverSubtitle'])],
    ]
    title_table = Table(title_data, colWidths=[17*cm], rowHeights=[60, 30, 20, 20, 10, 30])
    title_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), PRIMARY),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 20),
        ('RIGHTPADDING', (0,0), (-1,-1), 20),
        ('TOPPADDING', (0,0), (0,0), 30),
    ]))
    elements.append(title_table)

    elements.append(spacer(40))

    # Tech stack summary
    tech_data = [
        [Paragraph('<b>Backend</b>', styles['TableCell']),
         Paragraph('Go 1.22 + Fiber v2 + PostgreSQL 16 + Redis 7', styles['TableCell'])],
        [Paragraph('<b>Frontend</b>', styles['TableCell']),
         Paragraph('Next.js 14 + React 18 + TypeScript + Tailwind CSS', styles['TableCell'])],
        [Paragraph('<b>Android</b>', styles['TableCell']),
         Paragraph('Kotlin + Jetpack Compose + ExoPlayer + Hilt', styles['TableCell'])],
        [Paragraph('<b>Infra</b>', styles['TableCell']),
         Paragraph('Docker Compose + nginx + Tailscale VPN', styles['TableCell'])],
    ]
    tech_table = Table(tech_data, colWidths=[4*cm, 13*cm])
    tech_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, BORDER),
        ('BACKGROUND', (0,0), (0,-1), LIGHT_BG),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(tech_table)

    elements.append(spacer(30))
    elements.append(Paragraph('Marzo 2026', ParagraphStyle('DateStyle', parent=styles['Normal'],
        fontSize=11, textColor=HexColor('#64748b'), alignment=TA_CENTER)))

    elements.append(PageBreak())
    return elements


def build_toc():
    """Build table of contents."""
    elements = []
    elements.append(chapter('Indice de Contenidos'))
    elements.append(spacer(10))

    toc_items = [
        ('1', 'Arquitectura del Proyecto'),
        ('2', 'Requisitos del Sistema'),
        ('3', 'Instalacion y Configuracion Inicial'),
        ('4', 'Docker y Contenedores'),
        ('5', 'Backend (Go/Fiber)'),
        ('6', 'Frontend (Next.js)'),
        ('7', 'Android (Kotlin/Compose)'),
        ('8', 'Base de Datos (PostgreSQL)'),
        ('9', 'Redis y Cache'),
        ('10', 'Nginx y Proxy Inverso'),
        ('11', 'Tailscale VPN'),
        ('12', 'Testing y Coverage'),
        ('13', 'Gestion de Versiones'),
        ('14', 'Operaciones Diarias'),
        ('15', 'Backups y Restauracion'),
        ('16', 'Streaming y Media'),
        ('17', 'Troubleshooting'),
        ('18', 'Referencia Rapida'),
    ]

    for num, title in toc_items:
        elements.append(Paragraph(
            f'<b>{num}.</b>  {title}',
            styles['TOCChapter']
        ))

    elements.append(PageBreak())
    return elements


def build_chapter_1():
    """Arquitectura del Proyecto."""
    e = []
    e.append(chapter('1. Arquitectura del Proyecto'))

    e.append(body('TIVIFY es una plataforma IPTV/OTT self-hosted compuesta por cuatro capas principales que se comunican a traves de una API REST y WebSockets.'))
    e.append(spacer())

    e.append(section('1.1 Diagrama de Componentes'))
    e.append(code(
        'Cliente (Web/Android)\n'
        '       |\n'
        '   [nginx :80/:443]  <-- Rate limiting, Security Headers, SSL\n'
        '       |         \\\n'
        '  [Frontend]   [Backend]  <-- API REST + WebSocket\n'
        '  Next.js:3000  Go:8080\n'
        '                  |    \\\n'
        '           [PostgreSQL]  [Redis]\n'
        '              :5432       :6379\n'
        '                  |\n'
        '            [FFmpeg]  <-- Transcodificacion HLS\n'
        '                  |\n'
        '           [/media volume]  <-- Videos, HLS segments, thumbnails'
    ))

    e.append(section('1.2 Stack Tecnologico'))
    e.append(make_table(
        ['Capa', 'Tecnologia', 'Funcion'],
        [
            ['Backend', 'Go 1.22 + Fiber v2', 'API REST, Auth JWT, WebSocket, FFmpeg'],
            ['ORM', 'GORM', 'Migraciones automaticas, relaciones'],
            ['Base de Datos', 'PostgreSQL 16', 'Datos persistentes, FTS (Full Text Search)'],
            ['Cache', 'Redis 7', 'Sesiones, cache de categorias, pub/sub'],
            ['Frontend', 'Next.js 14 + React 18', 'SPA con App Router, SSR, PWA'],
            ['UI', 'Tailwind CSS + shadcn/ui', 'Componentes accesibles, responsive'],
            ['Streaming', 'hls.js', 'Reproductor HLS adaptativo (web)'],
            ['Android', 'Kotlin + Compose', 'App nativa con Material 3'],
            ['Player Android', 'ExoPlayer / Media3', 'Reproduccion HLS nativa'],
            ['DI Android', 'Hilt (Dagger)', 'Inyeccion de dependencias'],
            ['Proxy', 'nginx', 'Reverse proxy, rate limiting, headers'],
            ['VPN', 'Tailscale', 'Acceso remoto encriptado'],
            ['Metricas', 'Prometheus', 'Metricas HTTP, contadores custom'],
            ['i18n', 'i18next', 'Internacionalizacion (es/en)'],
        ],
        [4*cm, 5*cm, 8*cm]
    ))

    e.append(section('1.3 Estructura de Directorios'))
    e.append(code(
        'TIVIFY/\n'
        '  backend/           # API Go + Fiber\n'
        '    cmd/server/      # Punto de entrada (main.go)\n'
        '    internal/\n'
        '      cache/         # Servicio de cache Redis\n'
        '      config/        # Configuracion desde env vars\n'
        '      database/      # Conexiones PostgreSQL + Redis\n'
        '      dto/           # Data Transfer Objects\n'
        '      handler/       # Controladores HTTP\n'
        '      metrics/       # Metricas Prometheus\n'
        '      middleware/     # Auth, CORS, Rate Limit, Logging\n'
        '      model/         # 16 modelos GORM\n'
        '      repository/    # Capa de acceso a datos\n'
        '      router/        # Definicion de rutas API\n'
        '      service/       # Logica de negocio\n'
        '      util/          # JWT, Logger, Validacion\n'
        '      ws/            # WebSocket hub\n'
        '  frontend/          # Next.js 14\n'
        '    src/app/         # App Router (pages)\n'
        '    src/components/  # Componentes React\n'
        '    src/context/     # Auth + Toast providers\n'
        '    src/lib/         # API client, utils, i18n\n'
        '    __tests__/       # Jest tests (99%+ coverage)\n'
        '  android/           # App Kotlin/Compose\n'
        '    app/src/main/java/com/tivify/app/\n'
        '      data/api/      # Retrofit API + Interceptors\n'
        '      di/            # Hilt modules\n'
        '      ui/            # Screens + ViewModels\n'
        '  docker/            # Docker Compose + configs\n'
        '    nginx/           # Nginx config\n'
        '    postgres/        # Init SQL\n'
        '    tailscale/       # VPN container\n'
        '  nginx/             # Nginx Dockerfile + conf.d/'
    ))

    e.append(PageBreak())
    return e


def build_chapter_2():
    """Requisitos del Sistema."""
    e = []
    e.append(chapter('2. Requisitos del Sistema'))

    e.append(section('2.1 Hardware Minimo'))
    e.append(make_table(
        ['Componente', 'Minimo', 'Recomendado'],
        [
            ['CPU', '2 cores', '4+ cores (para transcoding FFmpeg)'],
            ['RAM', '4 GB', '8+ GB'],
            ['Disco', '20 GB (SO + app)', '100+ GB (con media)'],
            ['Red', '10 Mbps', '100+ Mbps (streaming multiple)'],
        ],
        [4*cm, 5*cm, 8*cm]
    ))

    e.append(section('2.2 Software Requerido'))
    e.append(make_table(
        ['Software', 'Version', 'Proposito'],
        [
            ['Docker', '24.0+', 'Contenedores de todos los servicios'],
            ['Docker Compose', 'v2.20+', 'Orquestacion de servicios'],
            ['Git', '2.30+', 'Clonar repositorio'],
            ['Node.js', '18+ (opcional)', 'Desarrollo frontend local'],
            ['JDK 17 (opcional)', '17+', 'Desarrollo Android local'],
        ],
        [4*cm, 4*cm, 9*cm]
    ))

    e.append(section('2.3 Puertos Requeridos'))
    e.append(make_table(
        ['Puerto', 'Servicio', 'Exposicion'],
        [
            ['80', 'nginx (HTTP)', 'Publico'],
            ['443', 'nginx (HTTPS)', 'Publico'],
            ['8080', 'Backend Go', 'Solo interno (Docker network)'],
            ['3000', 'Frontend Next.js', 'Solo interno (Docker network)'],
            ['5432', 'PostgreSQL', 'Solo interno (Docker network)'],
            ['6379', 'Redis', 'Solo interno (Docker network)'],
        ],
        [3*cm, 5*cm, 9*cm]
    ))

    e.append(warning('Solo los puertos 80 y 443 se exponen al exterior. PostgreSQL y Redis NO deben ser accesibles desde fuera de la red Docker.'))

    e.append(PageBreak())
    return e


def build_chapter_3():
    """Instalacion y Configuracion."""
    e = []
    e.append(chapter('3. Instalacion y Configuracion Inicial'))

    e.append(section('3.1 Instalar Docker'))
    e.append(code(
        '# Ubuntu/Debian\n'
        'curl -fsSL https://get.docker.com | sh\n'
        'sudo usermod -aG docker $USER\n'
        'newgrp docker\n'
        '\n'
        '# Verificar\n'
        'docker --version\n'
        'docker compose version'
    ))

    e.append(section('3.2 Clonar el Proyecto'))
    e.append(code(
        'git clone <URL_REPOSITORIO> /opt/tivify\n'
        'cd /opt/tivify'
    ))

    e.append(section('3.3 Configurar Variables de Entorno'))
    e.append(body('Copiar el archivo de ejemplo y editar con valores de produccion:'))
    e.append(code(
        'cp .env.example .env\n'
        'nano .env'
    ))

    e.append(subsection('Variables Criticas de Seguridad'))
    e.append(make_table(
        ['Variable', 'Descripcion', 'Ejemplo'],
        [
            ['BASE_URL', 'URL publica del servidor', 'http://mi-servidor.com'],
            ['DB_PASSWORD', 'Password de PostgreSQL', 'P@ssw0rd_Segur0_2024!'],
            ['REDIS_PASSWORD', 'Password de Redis', 'R3d1s_S3cur3!'],
            ['JWT_SECRET', 'Clave JWT (min 32 chars)', 'clave-aleatoria-de-32-caracteres-min'],
            ['ADMIN_USERNAME', 'Usuario admin inicial', 'admin'],
            ['ADMIN_PASSWORD', 'Password admin inicial', 'CambiarEnPrimerLogin!'],
            ['ADMIN_EMAIL', 'Email del admin', 'admin@dominio.com'],
        ],
        [4*cm, 5.5*cm, 7.5*cm]
    ))

    e.append(subsection('Variables de Streaming'))
    e.append(make_table(
        ['Variable', 'Descripcion', 'Default'],
        [
            ['FFMPEG_PRESET', 'Preset de codificacion', 'faster'],
            ['FFMPEG_HWACCEL', 'Aceleracion HW (nvidia/intel/none)', 'none'],
            ['FFMPEG_AUDIO_BITRATE', 'Bitrate de audio', '192k'],
            ['HLS_SEGMENT_DURATION', 'Duracion segmento HLS (seg)', '10'],
            ['HLS_PLAYLIST_SIZE', 'Segmentos en playlist HLS', '5'],
            ['LIBRARY_PATH', 'Ruta a biblioteca de medios', '/mnt/usb'],
            ['TMDB_API_KEY', 'API key de TheMovieDB', '(obtener en tmdb.org)'],
        ],
        [5*cm, 6*cm, 6*cm]
    ))

    e.append(subsection('Variables de Tailscale'))
    e.append(make_table(
        ['Variable', 'Descripcion', 'Ejemplo'],
        [
            ['TS_AUTHKEY', 'Auth key (efimera recomendada)', 'tskey-auth-xxxxx'],
            ['TS_HOSTNAME', 'Nombre en la tailnet', 'tivify'],
            ['TS_SERVE_MODE', 'Modo: https o proxy', 'https'],
            ['ENABLE_TAILSCALE', 'Habilitar VPN', 'true'],
        ],
        [4.5*cm, 6*cm, 6.5*cm]
    ))

    e.append(warning('Generar JWT_SECRET con: <font face="Courier">openssl rand -base64 48</font>. NUNCA usar el valor por defecto en produccion.'))

    e.append(section('3.4 Archivo .env Completo'))
    e.append(body('El archivo <font face="Courier">.env.example</font> contiene 152 lineas con TODAS las variables disponibles, agrupadas por seccion: General, PostgreSQL, Redis, Backend, Frontend, Admin, Tailscale, Library Scanner, Docker Runtime, Backup, Network, Security, API, Streaming, FFmpeg, APK, Database y Logging.'))

    e.append(PageBreak())
    return e


def build_chapter_4():
    """Docker y Contenedores."""
    e = []
    e.append(chapter('4. Docker y Contenedores'))

    e.append(section('4.1 Servicios Docker'))
    e.append(make_table(
        ['Servicio', 'Imagen', 'CPU', 'RAM', 'Funcion'],
        [
            ['postgres', 'postgres:16-alpine', '1 core', '1024 MB', 'Base de datos'],
            ['redis', 'redis:7-alpine', '0.5 core', '256 MB', 'Cache y sesiones'],
            ['backend', 'Custom (Go)', '1 core', '512 MB', 'API REST'],
            ['frontend', 'Custom (Next.js)', '0.5 core', '256 MB', 'Interfaz web'],
            ['nginx', 'Custom (nginx)', '1 core', '256 MB', 'Proxy inverso'],
            ['tailscale', 'Custom', '-', '-', 'VPN (network: nginx)'],
            ['android-build', 'Custom (Gradle)', '-', '-', 'Build APK (perfil)'],
        ],
        [3*cm, 3.5*cm, 1.5*cm, 1.5*cm, 3.5*cm]
    ))

    e.append(section('4.2 Levantar Todos los Servicios'))
    e.append(code(
        'cd /opt/tivify/docker\n'
        'docker compose up -d\n'
        '\n'
        '# Verificar que todos estan healthy\n'
        'docker compose ps\n'
        '\n'
        '# Orden de arranque automatico:\n'
        '#   postgres -> redis -> backend -> frontend -> nginx -> tailscale'
    ))

    e.append(section('4.3 Reconstruir un Servicio'))
    e.append(code(
        '# Reconstruir solo el backend\n'
        'cd /opt/tivify/docker\n'
        'docker compose up -d --build backend\n'
        '\n'
        '# Reconstruir solo el frontend\n'
        'docker compose up -d --build frontend\n'
        '\n'
        '# Reconstruir TODO desde cero\n'
        'docker compose up -d --build --force-recreate'
    ))

    e.append(section('4.4 Ver Logs'))
    e.append(code(
        '# Logs de todos los servicios\n'
        'docker compose logs -f\n'
        '\n'
        '# Logs de un servicio especifico\n'
        'docker compose logs -f backend\n'
        'docker compose logs -f frontend\n'
        'docker compose logs -f postgres\n'
        '\n'
        '# Ultimas 100 lineas\n'
        'docker compose logs --tail=100 backend'
    ))

    e.append(section('4.5 Parar y Reiniciar'))
    e.append(code(
        '# Parar todo (conserva datos)\n'
        'docker compose down\n'
        '\n'
        '# Parar y BORRAR volumenes (PELIGRO: pierde datos)\n'
        'docker compose down -v\n'
        '\n'
        '# Reiniciar un servicio\n'
        'docker compose restart backend\n'
        '\n'
        '# Parar un servicio\n'
        'docker compose stop frontend'
    ))

    e.append(warning('NUNCA usar <font face="Courier">docker compose down -v</font> en produccion sin backup previo. Esto destruye TODOS los datos incluyendo la base de datos.'))

    e.append(section('4.6 Volumenes Docker'))
    e.append(make_table(
        ['Volumen', 'Contenido', 'Critico', 'Backup'],
        [
            ['postgres_data', 'Base de datos completa', 'SI', 'pg_dump diario'],
            ['redis_data', 'Cache y sesiones', 'No', 'Regenerable'],
            ['media_data', 'Videos, HLS, thumbnails', 'SI', 'rsync/tar'],
            ['tailscale_data', 'Estado VPN', 'No', 'Regenerable'],
            ['apk_output', 'APK compilada', 'No', 'Regenerable'],
            ['gradle_cache', 'Cache de Gradle', 'No', 'Regenerable'],
        ],
        [4*cm, 5*cm, 2.5*cm, 5.5*cm]
    ))

    e.append(section('4.7 Modo Desarrollo'))
    e.append(code(
        '# Usar docker-compose.dev.yml (expone puertos adicionales)\n'
        'docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d\n'
        '\n'
        '# Esto expone:\n'
        '#   PostgreSQL en localhost:5432\n'
        '#   Redis en localhost:6379\n'
        '#   Backend en localhost:8080'
    ))

    e.append(PageBreak())
    return e


def build_chapter_5():
    """Backend."""
    e = []
    e.append(chapter('5. Backend (Go/Fiber)'))

    e.append(section('5.1 Estructura'))
    e.append(code(
        'backend/\n'
        '  cmd/server/main.go     # Punto de entrada\n'
        '  internal/\n'
        '    config/config.go     # Carga de env vars\n'
        '    database/database.go # Conexion PostgreSQL + Redis\n'
        '    model/               # 16 modelos GORM\n'
        '    repository/          # Queries a BD\n'
        '    service/             # Logica de negocio\n'
        '    handler/             # Controladores HTTP\n'
        '    router/router.go     # Definicion de rutas\n'
        '    middleware/           # Auth, CORS, Rate Limit\n'
        '    cache/cache.go       # Servicio Redis\n'
        '    ws/hub.go            # WebSocket hub\n'
        '    metrics/metrics.go   # Prometheus counters\n'
        '    util/                # JWT, Logger, Validacion\n'
        '  Dockerfile             # Multi-stage build\n'
        '  go.mod                 # Dependencias'
    ))

    e.append(section('5.2 Desarrollo Local con Docker'))
    e.append(body('Go NO se instala localmente. Todo se ejecuta via Docker:'))
    e.append(code(
        '# Compilar y verificar\n'
        'MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/app" \\\n'
        '  -w /app/backend golang:1.22 go build ./...\n'
        '\n'
        '# Ejecutar tests\n'
        'MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/app" \\\n'
        '  -w /app/backend golang:1.22 go test ./...\n'
        '\n'
        '# Ejecutar vet (linter)\n'
        'MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/app" \\\n'
        '  -w /app/backend golang:1.22 go vet ./...'
    ))

    e.append(section('5.3 API Endpoints Completa'))

    e.append(subsection('Autenticacion (Publicas)'))
    e.append(make_table(
        ['Metodo', 'Ruta', 'Descripcion'],
        [
            ['POST', '/api/v1/auth/login', 'Login (devuelve access + refresh token)'],
            ['POST', '/api/v1/auth/refresh', 'Renovar access token'],
            ['POST', '/api/v1/auth/logout', 'Cerrar sesion (invalida refresh token)'],
            ['GET', '/api/v1/auth/me', 'Datos del usuario autenticado'],
        ],
        [2.5*cm, 5.5*cm, 9*cm]
    ))

    e.append(subsection('Contenido de Usuario (Protegidas)'))
    e.append(make_table(
        ['Metodo', 'Ruta', 'Descripcion'],
        [
            ['GET', '/api/v1/channels', 'Listar canales activos'],
            ['GET', '/api/v1/channels/:id', 'Detalle de canal'],
            ['GET', '/api/v1/vod', 'Listar peliculas/VOD'],
            ['GET', '/api/v1/vod/:id', 'Detalle de VOD'],
            ['GET', '/api/v1/series', 'Listar series'],
            ['GET', '/api/v1/series/:id', 'Detalle de serie'],
            ['GET', '/api/v1/series/:id/episodes', 'Episodios de una serie'],
            ['GET', '/api/v1/categories', 'Categorias por tipo'],
            ['GET', '/api/v1/search', 'Busqueda full-text global'],
            ['GET', '/api/v1/favorites', 'Listar favoritos del usuario'],
            ['POST', '/api/v1/favorites/toggle', 'Agregar/quitar favorito'],
            ['GET', '/api/v1/history', 'Historial de reproduccion'],
            ['GET', '/api/v1/history/continue', 'Continuar viendo'],
            ['POST', '/api/v1/history', 'Registrar posicion de reproduccion'],
            ['DELETE', '/api/v1/history/:id', 'Eliminar entrada del historial'],
            ['GET', '/api/v1/emissions/live', 'Canales con emision en vivo'],
            ['GET', '/api/v1/epg', 'Guia electronica de programacion'],
            ['PUT', '/api/v1/profile', 'Actualizar perfil'],
            ['PUT', '/api/v1/profile/password', 'Cambiar password'],
        ],
        [2*cm, 5.5*cm, 9.5*cm]
    ))

    e.append(PageBreak())

    e.append(subsection('Administracion (Admin Only)'))
    e.append(make_table(
        ['Recurso', 'Rutas', 'Operaciones'],
        [
            ['Dashboard', '/admin/dashboard/stats', 'GET estadisticas'],
            ['Canales', '/admin/channels[/:id]', 'CRUD + streams'],
            ['VOD', '/admin/vod[/:id]', 'CRUD + enrich TMDB'],
            ['Series', '/admin/series[/:id]', 'CRUD + enrich TMDB'],
            ['Categorias', '/admin/categories[/:id]', 'CRUD + by-type'],
            ['Usuarios', '/admin/users[/:id]', 'CRUD'],
            ['EPG', '/admin/epg[/:id]', 'CRUD'],
            ['IPTV', '/admin/iptv/*', 'Import M3U, status, delete'],
            ['Media', '/admin/media/*', 'Upload, list, diagnostics'],
            ['Library', '/admin/library/*', 'Scan, import, TMDB search'],
            ['Emisiones', '/admin/channels/:id/emission/*', 'Start/stop/status FFmpeg'],
            ['Playlist', '/admin/channels/:id/playlist/*', 'Items, reorder, generate'],
            ['Tailscale', '/admin/tailscale/*', 'Status, start/stop/restart'],
        ],
        [3*cm, 5.5*cm, 8.5*cm]
    ))

    e.append(subsection('Infraestructura'))
    e.append(make_table(
        ['Metodo', 'Ruta', 'Descripcion'],
        [
            ['GET', '/health', 'Health check (DB + Redis + uptime)'],
            ['GET', '/api/version', 'Version del backend'],
            ['GET', '/metrics', 'Metricas Prometheus'],
            ['WS', '/ws?token=JWT', 'WebSocket eventos en tiempo real'],
            ['GET', '/api/internal/validate-stream-token', 'Validacion interna (nginx)'],
        ],
        [2*cm, 7*cm, 8*cm]
    ))

    e.append(subsection('Xtream Codes (Compatibilidad IPTV)'))
    e.append(make_table(
        ['Metodo', 'Ruta', 'Descripcion'],
        [
            ['GET', '/player_api.php', 'API Xtream Codes completa'],
            ['GET', '/xmltv.php', 'EPG en formato XMLTV'],
            ['GET', '/get.php', 'Endpoint de stream'],
            ['GET', '/live/:user/:pass/:id', 'Stream en vivo'],
            ['GET', '/movie/:user/:pass/:id', 'Stream VOD'],
            ['GET', '/series/:user/:pass/:id', 'Stream serie'],
        ],
        [2*cm, 5.5*cm, 9.5*cm]
    ))

    e.append(section('5.4 Modelos de Datos'))
    e.append(body('El backend define 16 modelos GORM con migracion automatica:'))
    e.append(make_table(
        ['Modelo', 'Tabla', 'Descripcion'],
        [
            ['User', 'users', 'Usuarios (admin/user) + bcrypt hash'],
            ['Session', 'sessions', 'Refresh tokens activos'],
            ['Channel', 'channels', 'Canales de TV'],
            ['Stream', 'streams', 'URLs de stream por canal'],
            ['Category', 'categories', 'Categorias (channel/vod/series)'],
            ['VOD', 'vods', 'Peliculas y videos on demand'],
            ['Series', 'series', 'Series de TV'],
            ['Episode', 'episodes', 'Episodios de series'],
            ['Favorite', 'favorites', 'Favoritos por usuario'],
            ['WatchHistory', 'watch_histories', 'Historial + posicion'],
            ['EPGSource', 'epg_sources', 'Fuentes EPG (XMLTV)'],
            ['EPGProgram', 'epg_programs', 'Programas de la guia'],
            ['LocalMedia', 'local_media', 'Archivos multimedia locales'],
            ['Playlist', 'playlists', 'Playlists de canales'],
            ['PlaylistItem', 'playlist_items', 'Items de playlist'],
            ['Emission', 'emissions', 'Emisiones FFmpeg activas'],
        ],
        [3.5*cm, 4*cm, 9.5*cm]
    ))

    e.append(PageBreak())
    return e


def build_chapter_6():
    """Frontend."""
    e = []
    e.append(chapter('6. Frontend (Next.js)'))

    e.append(section('6.1 Estructura'))
    e.append(code(
        'frontend/\n'
        '  src/\n'
        '    app/\n'
        '      (auth)/login/    # Pagina de login\n'
        '      (user)/\n'
        '        home/          # Dashboard del usuario\n'
        '        channels/[id]/ # Reproductor de canal en vivo\n'
        '        vod/[id]/      # Reproductor de pelicula\n'
        '        series/[id]/   # Detalle + episodios\n'
        '        favorites/     # Contenido favorito\n'
        '        history/       # Historial de reproduccion\n'
        '        guide/         # Guia EPG\n'
        '        settings/      # Configuracion de usuario\n'
        '      admin/\n'
        '        channels/      # CRUD canales\n'
        '        iptv/          # Importar M3U\n'
        '        vod/           # CRUD peliculas\n'
        '        series/        # CRUD series\n'
        '        categories/    # CRUD categorias\n'
        '        library/       # Escaner de medios\n'
        '        epg/           # Fuentes EPG\n'
        '        users/         # CRUD usuarios\n'
        '        tailscale/     # Estado VPN\n'
        '    components/ui/     # Componentes reutilizables\n'
        '    context/           # AuthContext + ToastContext\n'
        '    lib/               # API, utils, i18n, websocket\n'
        '  __tests__/           # 88 suites, 1434 tests'
    ))

    e.append(section('6.2 Desarrollo Local'))
    e.append(code(
        '# Instalar dependencias\n'
        'cd frontend\n'
        'npm install\n'
        '\n'
        '# Modo desarrollo (hot reload)\n'
        'npm run dev\n'
        '# Abre en http://localhost:3000\n'
        '\n'
        '# Build de produccion\n'
        'npm run build\n'
        'npm start'
    ))

    e.append(section('6.3 Dependencias Principales'))
    e.append(make_table(
        ['Paquete', 'Version', 'Uso'],
        [
            ['next', '14.2.29', 'Framework React con App Router'],
            ['react / react-dom', '18.x', 'UI Library'],
            ['tailwindcss', '3.4.17', 'CSS utility-first'],
            ['axios', '1.8.4', 'Cliente HTTP'],
            ['hls.js', '1.6.0', 'Reproductor HLS (web)'],
            ['i18next', '24.2.2', 'Internacionalizacion'],
            ['lucide-react', '0.475.0', 'Iconos'],
            ['clsx + tailwind-merge', '-', 'Utilidades CSS'],
        ],
        [4*cm, 3*cm, 10*cm]
    ))

    e.append(section('6.4 Caracteristicas Especiales'))
    e.append(bullet('<b>PWA:</b> Service Worker para funcionamiento offline (manifest + sw.js)'))
    e.append(bullet('<b>i18n:</b> Soporte completo espanol/ingles via i18next'))
    e.append(bullet('<b>WebSocket:</b> Eventos en tiempo real (actualizaciones de canales, emisiones)'))
    e.append(bullet('<b>Responsive:</b> Diseno adaptativo para movil, tablet y desktop'))
    e.append(bullet('<b>Accesibilidad:</b> Componentes con roles ARIA, navegacion por teclado'))
    e.append(bullet('<b>Video Player:</b> Controles personalizados, calidad adaptativa, PiP'))

    e.append(PageBreak())
    return e


def build_chapter_7():
    """Android."""
    e = []
    e.append(chapter('7. Android (Kotlin/Compose)'))

    e.append(section('7.1 Estructura'))
    e.append(code(
        'android/app/src/main/java/com/tivify/app/\n'
        '  TivifyApp.kt          # Application class (Hilt)\n'
        '  data/\n'
        '    api/\n'
        '      TivifyApi.kt      # Retrofit interface\n'
        '      AuthInterceptor.kt\n'
        '      BaseUrlInterceptor.kt\n'
        '      UnauthorizedInterceptor.kt\n'
        '  di/\n'
        '    AppModule.kt        # Hilt: Retrofit, DataStore, etc.\n'
        '  ui/\n'
        '    login/              # Login screen + ViewModel\n'
        '    home/               # Dashboard + ViewModel\n'
        '    channels/           # Lista + detalle + ViewModel\n'
        '    player/             # ExoPlayer + controles\n'
        '    vod/                # Peliculas + ViewModel\n'
        '    series/             # Series + ViewModel\n'
        '    favorites/          # Favoritos + ViewModel\n'
        '    history/            # Historial + ViewModel\n'
        '    epg/                # Guia EPG + ViewModel\n'
        '    profile/            # Perfil usuario\n'
        '    about/              # Acerca de\n'
        '    navigation/         # NavHost + rutas\n'
        '    splash/             # Splash screen\n'
        '    theme/              # Material 3 theme'
    ))

    e.append(section('7.2 Generar APK con Docker'))
    e.append(warning('Seguir SIEMPRE estos pasos exactos. No usar atajos.'))

    e.append(subsection('Paso 1: Sincronizar VERSION'))
    e.append(code('cp VERSION android/VERSION'))

    e.append(subsection('Paso 2: Build con --no-cache'))
    e.append(code(
        'docker build --no-cache -t tivify-android -f android/Dockerfile android/'
    ))
    e.append(body('SIEMPRE usar --no-cache para evitar servir APKs de capas cacheadas.'))

    e.append(subsection('Paso 3: Extraer APK con docker cp'))
    e.append(code(
        'docker create --name tivify-extract tivify-android\n'
        'docker cp tivify-extract:/app/app/build/outputs/apk/debug/app-debug.apk \\\n'
        '  ./tivify-v2.4.0.apk\n'
        'docker rm -f tivify-extract'
    ))
    e.append(warning('NUNCA usar docker run -v para extraer. Los volume mounts de Windows a Linux no funcionan correctamente y entregan APKs viejas.'))

    e.append(subsection('Paso 4: Verificar APK'))
    e.append(code(
        'docker create --name verify-apk tivify-android bash -c \\\n'
        '  \'/opt/android-sdk/build-tools/35.0.0/aapt dump badging \\\n'
        '   /tmp/app.apk 2>/dev/null | grep -E "versionCode|versionName"; \\\n'
        '   md5sum /tmp/app.apk; \\\n'
        '   md5sum /app/app/build/outputs/apk/debug/app-debug.apk\'\n'
        'docker cp ./tivify-v2.4.0.apk verify-apk:/tmp/app.apk\n'
        'docker start -a verify-apk\n'
        'docker rm -f verify-apk'
    ))
    e.append(body('Verificar que: versionName coincide con VERSION, y los checksums MD5 son identicos.'))

    e.append(subsection('Paso 5: Build via Docker Compose (alternativa)'))
    e.append(code(
        'cd docker\n'
        'docker compose --profile build-apk up android-build\n'
        '# La APK queda en el volumen apk_output'
    ))

    e.append(section('7.3 Configuracion del Build'))
    e.append(make_table(
        ['Parametro', 'Valor', 'Archivo'],
        [
            ['minSdk', '24 (Android 7.0)', 'build.gradle.kts'],
            ['targetSdk', '35', 'build.gradle.kts'],
            ['compileSdk', '35', 'build.gradle.kts'],
            ['Kotlin', '2.0.21', 'build.gradle.kts'],
            ['Gradle', '8.11.1', 'gradle-wrapper.properties'],
            ['AGP', '8.7.3', 'build.gradle.kts (project)'],
            ['versionCode', '6 (incrementar siempre +1)', 'build.gradle.kts'],
            ['versionName', 'Lee de archivo VERSION', 'build.gradle.kts'],
        ],
        [4*cm, 5*cm, 8*cm]
    ))

    e.append(PageBreak())
    return e


def build_chapter_8():
    """Base de Datos."""
    e = []
    e.append(chapter('8. Base de Datos (PostgreSQL)'))

    e.append(section('8.1 Configuracion'))
    e.append(body('PostgreSQL 16 Alpine con configuracion optimizada:'))
    e.append(code(
        '# docker-compose.yml\n'
        'command:\n'
        '  - "postgres"\n'
        '  - "-c" - "max_connections=200"\n'
        '  - "-c" - "shared_buffers=256MB"'
    ))

    e.append(section('8.2 Migraciones'))
    e.append(body('GORM ejecuta migraciones automaticas al arrancar el backend. El archivo <font face="Courier">docker/postgres/init.sql</font> contiene la configuracion inicial de la base de datos.'))

    e.append(section('8.3 Acceso a la Base de Datos'))
    e.append(code(
        '# Abrir psql dentro del contenedor\n'
        'docker exec -it tivify-postgres psql -U tivify -d tivify\n'
        '\n'
        '# Consultas utiles\n'
        '\\dt                          -- Listar tablas\n'
        '\\d+ users                    -- Estructura de tabla users\n'
        'SELECT count(*) FROM users;  -- Contar usuarios\n'
        'SELECT count(*) FROM channels; -- Contar canales\n'
        '\\q                           -- Salir'
    ))

    e.append(section('8.4 Backup'))
    e.append(code(
        '# Backup completo\n'
        'docker exec tivify-postgres pg_dump -U tivify tivify > \\\n'
        '  backup_$(date +%Y%m%d_%H%M%S).sql\n'
        '\n'
        '# Backup comprimido\n'
        'docker exec tivify-postgres pg_dump -U tivify -Fc tivify > \\\n'
        '  backup_$(date +%Y%m%d).dump\n'
        '\n'
        '# Backup automatizado (cron)\n'
        '0 2 * * * docker exec tivify-postgres pg_dump -U tivify tivify | \\\n'
        '  gzip > /backups/tivify_$(date +\\%Y\\%m\\%d).sql.gz'
    ))

    e.append(section('8.5 Restauracion'))
    e.append(code(
        '# Desde SQL plano\n'
        'cat backup.sql | docker exec -i tivify-postgres psql -U tivify -d tivify\n'
        '\n'
        '# Desde dump binario\n'
        'docker exec -i tivify-postgres pg_restore -U tivify -d tivify < backup.dump\n'
        '\n'
        '# Restauracion completa (recrear BD)\n'
        'docker exec tivify-postgres dropdb -U tivify tivify\n'
        'docker exec tivify-postgres createdb -U tivify tivify\n'
        'cat backup.sql | docker exec -i tivify-postgres psql -U tivify -d tivify'
    ))

    e.append(warning('Siempre hacer backup ANTES de restaurar. La restauracion sobreescribe datos existentes.'))

    e.append(PageBreak())
    return e


def build_chapter_9():
    """Redis."""
    e = []
    e.append(chapter('9. Redis y Cache'))

    e.append(section('9.1 Configuracion'))
    e.append(body('Redis 7 Alpine con autenticacion por password:'))
    e.append(code(
        '# docker-compose.yml\n'
        'command: redis-server --requirepass ${REDIS_PASSWORD}\n'
        '\n'
        '# Limite de memoria: 256 MB\n'
        '# Volumen: redis_data:/data'
    ))

    e.append(section('9.2 Uso en la Aplicacion'))
    e.append(make_table(
        ['Funcion', 'Clave', 'TTL'],
        [
            ['Sesiones (refresh tokens)', 'session:*', '168h (7 dias)'],
            ['Cache de categorias', 'categories:*', '10 min'],
            ['WebSocket pub/sub', 'ws:*', '-'],
        ],
        [5*cm, 5*cm, 7*cm]
    ))

    e.append(section('9.3 Comandos Utiles'))
    e.append(code(
        '# Conectar a Redis\n'
        'docker exec -it tivify-redis redis-cli -a ${REDIS_PASSWORD}\n'
        '\n'
        '# Ver todas las claves\n'
        'KEYS *\n'
        '\n'
        '# Ver info de memoria\n'
        'INFO memory\n'
        '\n'
        '# Flush cache (no afecta sesiones)\n'
        'DEL categories:channel categories:vod categories:series\n'
        '\n'
        '# Flush TODO (cierra todas las sesiones)\n'
        'FLUSHALL\n'
        '\n'
        '# Monitor de comandos en tiempo real\n'
        'MONITOR'
    ))

    e.append(PageBreak())
    return e


def build_chapter_10():
    """Nginx."""
    e = []
    e.append(chapter('10. Nginx y Proxy Inverso'))

    e.append(section('10.1 Arquitectura'))
    e.append(body('nginx actua como punto de entrada unico, distribuyendo trafico al backend y frontend segun la ruta:'))
    e.append(code(
        '/                    -> frontend:3000  (Next.js)\n'
        '/api/*               -> backend:8080   (Go API)\n'
        '/ws                  -> backend:8080   (WebSocket)\n'
        '/health              -> backend:8080   (Health check)\n'
        '/metrics             -> backend:8080   (Prometheus)\n'
        '/media/*             -> /media/         (Archivos estaticos)\n'
        '/library/*           -> /library/       (Biblioteca local)\n'
        '/player_api.php      -> backend:8080   (Xtream Codes)\n'
        '/tivify.apk          -> /output/        (APK download)'
    ))

    e.append(section('10.2 Rate Limiting'))
    e.append(make_table(
        ['Zona', 'Limite', 'Aplicado a'],
        [
            ['auth_limit', '5 req/min', '/api/v1/auth/*'],
            ['api_limit', '30 req/s (burst 50)', '/api/*'],
            ['upload_limit', '5 req/min', 'Uploads de archivos'],
        ],
        [4*cm, 5*cm, 8*cm]
    ))

    e.append(section('10.3 Headers de Seguridad'))
    e.append(code(
        'X-Content-Type-Options: nosniff\n'
        'X-Frame-Options: DENY\n'
        'X-XSS-Protection: 1; mode=block\n'
        'Content-Security-Policy: default-src \'self\'; ...\n'
        'Strict-Transport-Security: max-age=31536000\n'
        'Permissions-Policy: camera=(), microphone=(), geolocation=()'
    ))

    e.append(section('10.4 Archivos de Configuracion'))
    e.append(code(
        'nginx/\n'
        '  Dockerfile           # Build de imagen nginx\n'
        '  nginx.conf           # Configuracion principal\n'
        '  conf.d/\n'
        '    default.conf       # Rutas, upstream, seguridad (282 lineas)'
    ))

    e.append(section('10.5 Recargar Configuracion'))
    e.append(code(
        '# Sin reiniciar (reload graceful)\n'
        'docker exec tivify-nginx nginx -s reload\n'
        '\n'
        '# Verificar config antes de recargar\n'
        'docker exec tivify-nginx nginx -t'
    ))

    e.append(PageBreak())
    return e


def build_chapter_11():
    """Tailscale."""
    e = []
    e.append(chapter('11. Tailscale VPN'))

    e.append(section('11.1 Funcion'))
    e.append(body('Tailscale proporciona acceso remoto seguro al servidor sin necesidad de abrir puertos ni configurar port forwarding. Crea una red VPN encriptada (WireGuard) entre tus dispositivos.'))

    e.append(section('11.2 Configuracion'))
    e.append(code(
        '# En .env\n'
        'TS_AUTHKEY=tskey-auth-xxxxx   # Obtener en login.tailscale.com\n'
        'TS_HOSTNAME=tivify            # Nombre en la tailnet\n'
        'TS_SERVE_MODE=https           # https = certificados automaticos\n'
        'ENABLE_TAILSCALE=true'
    ))

    e.append(section('11.3 Gestion desde el Panel Admin'))
    e.append(body('El panel de administracion incluye controles para Tailscale:'))
    e.append(make_table(
        ['Accion', 'Endpoint', 'Descripcion'],
        [
            ['Ver estado', 'GET /admin/tailscale/status', 'IP, hostname, conectado'],
            ['Iniciar', 'POST /admin/tailscale/start', 'Arrancar contenedor'],
            ['Parar', 'POST /admin/tailscale/stop', 'Detener contenedor'],
            ['Reiniciar', 'POST /admin/tailscale/restart', 'Restart contenedor'],
        ],
        [3*cm, 6*cm, 8*cm]
    ))

    e.append(section('11.4 Acceso Remoto'))
    e.append(code(
        '# Acceder desde cualquier dispositivo en tu tailnet:\n'
        'https://tivify.tu-tailnet.ts.net\n'
        '\n'
        '# La app Android debe configurar la URL del servidor a:\n'
        'https://tivify.tu-tailnet.ts.net'
    ))

    e.append(section('11.5 Arquitectura de Red'))
    e.append(code(
        'Tailscale Container\n'
        '  |\n'
        '  network_mode: "service:nginx"\n'
        '  |\n'
        '  Comparte la red con nginx\n'
        '  -> Trafico entra por Tailscale\n'
        '  -> nginx lo distribuye como si fuera trafico local'
    ))

    e.append(PageBreak())
    return e


def build_chapter_12():
    """Testing."""
    e = []
    e.append(chapter('12. Testing y Coverage'))

    e.append(section('12.1 Frontend (Jest + React Testing Library)'))
    e.append(code(
        '# Ejecutar todos los tests\n'
        'cd frontend\n'
        'npx jest --no-coverage\n'
        '\n'
        '# Con coverage\n'
        'npx jest --coverage\n'
        '\n'
        '# Tests de un archivo especifico\n'
        'npx jest __tests__/lib/api.test.ts\n'
        '\n'
        '# Tests por patron\n'
        'npx jest --testPathPattern="admin"\n'
        '\n'
        '# Watch mode (re-ejecuta al cambiar)\n'
        'npx jest --watch'
    ))

    e.append(subsection('Estadisticas Actuales'))
    e.append(make_table(
        ['Metrica', 'Valor'],
        [
            ['Test suites', '88'],
            ['Tests totales', '1,434'],
            ['Lineas cubiertas', '99.08%'],
            ['Statements', '97.74%'],
            ['Branches', '88.15%'],
            ['Functions', '97.70%'],
        ],
        [6*cm, 11*cm]
    ))

    e.append(section('12.2 Backend (Go Test via Docker)'))
    e.append(code(
        '# Ejecutar todos los tests del backend\n'
        'MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/app" \\\n'
        '  -w /app/backend golang:1.22 go test ./...\n'
        '\n'
        '# Con verbose\n'
        'MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/app" \\\n'
        '  -w /app/backend golang:1.22 go test -v ./...\n'
        '\n'
        '# Coverage\n'
        'MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/app" \\\n'
        '  -w /app/backend golang:1.22 go test -cover ./...\n'
        '\n'
        '# Un paquete especifico\n'
        'MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/app" \\\n'
        '  -w /app/backend golang:1.22 go test ./internal/service/...'
    ))

    e.append(section('12.3 Android (Gradle)'))
    e.append(code(
        '# Tests unitarios\n'
        './gradlew testDebugUnitTest\n'
        '\n'
        '# Via Docker\n'
        'docker run --rm -v "$(pwd)/android:/app" -w /app \\\n'
        '  gradle:8.11-jdk17 ./gradlew testDebugUnitTest'
    ))

    e.append(section('12.4 Linting y Analisis Estatico'))
    e.append(code(
        '# Go vet\n'
        'MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/app" \\\n'
        '  -w /app/backend golang:1.22 go vet ./...\n'
        '\n'
        '# Frontend lint\n'
        'cd frontend && npm run lint\n'
        '\n'
        '# TypeScript check\n'
        'cd frontend && npx tsc --noEmit'
    ))

    e.append(PageBreak())
    return e


def build_chapter_13():
    """Gestion de Versiones."""
    e = []
    e.append(chapter('13. Gestion de Versiones'))

    e.append(section('13.1 Archivo VERSION'))
    e.append(body('El archivo <font face="Courier">VERSION</font> en la raiz del proyecto contiene la version semver (MAJOR.MINOR.PATCH). Actualmente: <b>2.4.0</b>'))

    e.append(section('13.2 Proceso de Incremento'))
    e.append(code(
        '# 1. Actualizar VERSION en la raiz\n'
        'echo "2.5.0" > VERSION\n'
        '\n'
        '# 2. Incrementar versionCode en android/app/build.gradle.kts\n'
        '# Buscar: versionCode = 6  ->  versionCode = 7\n'
        '# (siempre +1, nunca decrementar)\n'
        '\n'
        '# 3. Copiar VERSION a android/ antes de build\n'
        'cp VERSION android/VERSION'
    ))

    e.append(section('13.3 Donde se Usa la Version'))
    e.append(make_table(
        ['Componente', 'Fuente', 'Como se lee'],
        [
            ['Backend', 'internal/version/', 'Compilada con ldflags'],
            ['Frontend', 'package.json', 'npm version'],
            ['Android', 'VERSION + build.gradle.kts', 'Lee archivo VERSION en build'],
            ['Docker', 'VERSION', 'ARG en Dockerfile'],
            ['API', 'GET /api/version', 'Endpoint publico'],
            ['Health', 'GET /health', 'Campo version en JSON'],
        ],
        [4*cm, 5*cm, 8*cm]
    ))

    e.append(section('13.4 Versionado Semantico'))
    e.append(bullet('<b>MAJOR:</b> Cambios incompatibles en la API'))
    e.append(bullet('<b>MINOR:</b> Nuevas funcionalidades retrocompatibles'))
    e.append(bullet('<b>PATCH:</b> Correcciones de bugs'))

    e.append(PageBreak())
    return e


def build_chapter_14():
    """Operaciones Diarias."""
    e = []
    e.append(chapter('14. Operaciones Diarias'))

    e.append(section('14.1 Verificacion de Salud'))
    e.append(code(
        '# Health check completo\n'
        'curl -s http://localhost/health | python3 -m json.tool\n'
        '\n'
        '# Respuesta esperada:\n'
        '# {\n'
        '#   "status": "ok",\n'
        '#   "database": "ok",\n'
        '#   "redis": "ok",\n'
        '#   "uptime": "72h30m15s",\n'
        '#   "version": "2.4.0"\n'
        '# }\n'
        '\n'
        '# Estado de contenedores\n'
        'cd /opt/tivify/docker\n'
        'docker compose ps'
    ))

    e.append(section('14.2 Monitoreo de Logs'))
    e.append(code(
        '# Logs en tiempo real (todos)\n'
        'docker compose logs -f\n'
        '\n'
        '# Solo errores del backend\n'
        'docker compose logs -f backend 2>&1 | grep -i error\n'
        '\n'
        '# Ultimas 50 lineas de un servicio\n'
        'docker compose logs --tail=50 nginx'
    ))

    e.append(section('14.3 Metricas Prometheus'))
    e.append(code(
        '# Acceder a metricas\n'
        'curl -s http://localhost/metrics\n'
        '\n'
        '# Metricas disponibles:\n'
        '#   http_requests_total{method, path, status}\n'
        '#   http_request_duration_seconds{method, path}\n'
        '#   active_connections\n'
        '#   ...counters custom por handler'
    ))

    e.append(section('14.4 Mantenimiento'))
    e.append(code(
        '# Limpiar imagenes Docker no usadas\n'
        'docker system prune -f\n'
        '\n'
        '# Limpiar cache de Redis\n'
        'docker exec tivify-redis redis-cli -a $REDIS_PASSWORD FLUSHDB\n'
        '\n'
        '# Verificar espacio en disco\n'
        'df -h\n'
        'docker system df'
    ))

    e.append(PageBreak())
    return e


def build_chapter_15():
    """Backups."""
    e = []
    e.append(chapter('15. Backups y Restauracion'))

    e.append(section('15.1 Que Datos Son Criticos'))
    e.append(make_table(
        ['Dato', 'Ubicacion', 'Prioridad', 'Metodo'],
        [
            ['Base de datos', 'postgres_data volume', 'CRITICA', 'pg_dump'],
            ['Archivos media', 'media_data volume', 'CRITICA', 'rsync/tar'],
            ['Configuracion', '.env', 'ALTA', 'Copia manual'],
            ['Codigo fuente', 'Repositorio Git', 'ALTA', 'git push'],
            ['Cache Redis', 'redis_data volume', 'BAJA', 'Regenerable'],
        ],
        [4*cm, 4.5*cm, 2.5*cm, 6*cm]
    ))

    e.append(section('15.2 Script de Backup Completo'))
    e.append(code(
        '#!/bin/bash\n'
        'BACKUP_DIR="/backups/tivify/$(date +%Y%m%d)"\n'
        'mkdir -p $BACKUP_DIR\n'
        '\n'
        '# 1. Base de datos\n'
        'docker exec tivify-postgres pg_dump -U tivify -Fc tivify > \\\n'
        '  $BACKUP_DIR/database.dump\n'
        '\n'
        '# 2. Media files\n'
        'docker run --rm -v tivify_media_data:/data:ro \\\n'
        '  -v $BACKUP_DIR:/backup alpine \\\n'
        '  tar czf /backup/media.tar.gz -C /data .\n'
        '\n'
        '# 3. Configuracion\n'
        'cp /opt/tivify/.env $BACKUP_DIR/env.backup\n'
        '\n'
        '# 4. Limpiar backups antiguos (30 dias)\n'
        'find /backups/tivify -maxdepth 1 -mtime +30 -exec rm -rf {} \\;\n'
        '\n'
        'echo "Backup completado en $BACKUP_DIR"'
    ))

    e.append(section('15.3 Restauracion Completa'))
    e.append(code(
        '# 1. Parar servicios\n'
        'cd /opt/tivify/docker\n'
        'docker compose down\n'
        '\n'
        '# 2. Restaurar base de datos\n'
        'docker compose up -d postgres\n'
        'sleep 10  # Esperar que arranque\n'
        'docker exec -i tivify-postgres pg_restore -U tivify \\\n'
        '  -d tivify --clean < /backups/tivify/20260318/database.dump\n'
        '\n'
        '# 3. Restaurar media\n'
        'docker run --rm -v tivify_media_data:/data \\\n'
        '  -v /backups/tivify/20260318:/backup alpine \\\n'
        '  sh -c "rm -rf /data/* && tar xzf /backup/media.tar.gz -C /data"\n'
        '\n'
        '# 4. Restaurar .env\n'
        'cp /backups/tivify/20260318/env.backup /opt/tivify/.env\n'
        '\n'
        '# 5. Levantar todo\n'
        'docker compose up -d'
    ))

    e.append(PageBreak())
    return e


def build_chapter_16():
    """Streaming y Media."""
    e = []
    e.append(chapter('16. Streaming y Media'))

    e.append(section('16.1 Flujo de Streaming'))
    e.append(code(
        'Fuente (URL/archivo) -> FFmpeg -> Segmentos HLS (.ts + .m3u8)\n'
        '                                       |\n'
        '                                  /media/hls/\n'
        '                                       |\n'
        '                               nginx (servir estatico)\n'
        '                                       |\n'
        '                          hls.js (web) / ExoPlayer (Android)'
    ))

    e.append(section('16.2 Transcodificacion FFmpeg'))
    e.append(body('Configuracion via variables de entorno:'))
    e.append(make_table(
        ['Variable', 'Opciones', 'Default'],
        [
            ['FFMPEG_PRESET', 'ultrafast, superfast, veryfast, faster, fast, medium, slow', 'faster'],
            ['FFMPEG_HWACCEL', 'nvidia (NVENC), intel (QSV), none', 'none'],
            ['FFMPEG_AUDIO_BITRATE', '128k, 192k, 256k', '192k'],
            ['HLS_SEGMENT_DURATION', 'Segundos por segmento', '10'],
            ['HLS_PLAYLIST_SIZE', 'Segmentos en playlist', '5'],
        ],
        [5*cm, 6*cm, 6*cm]
    ))

    e.append(section('16.3 Emisiones en Vivo'))
    e.append(body('Las emisiones usan FFmpeg para convertir fuentes (URLs, archivos, playlists) en streams HLS en tiempo real:'))
    e.append(code(
        '# Desde el panel admin:\n'
        '# POST /api/v1/admin/channels/:id/emission/start\n'
        '# POST /api/v1/admin/channels/:id/emission/stop\n'
        '# GET  /api/v1/admin/channels/:id/emission/status\n'
        '\n'
        '# El proceso FFmpeg corre dentro del contenedor backend\n'
        '# Los segmentos HLS se escriben en /media/hls/{channel_id}/'
    ))

    e.append(section('16.4 Biblioteca Local'))
    e.append(body('El Library Scanner permite importar medios desde un disco externo o directorio montado:'))
    e.append(code(
        '# Configurar ruta en .env\n'
        'LIBRARY_PATH=/mnt/usb\n'
        '\n'
        '# Desde el panel admin:\n'
        '# POST /api/v1/admin/library/scan\n'
        '# GET  /api/v1/admin/library/scan/:sessionId/status\n'
        '# POST /api/v1/admin/library/import\n'
        '# POST /api/v1/admin/library/tmdb/search  (enriquecer metadata)'
    ))

    e.append(section('16.5 Upload de Media'))
    e.append(code(
        '# Upload directo de archivo\n'
        'POST /api/v1/admin/media/upload\n'
        '  Content-Type: multipart/form-data\n'
        '  Body: file=@pelicula.mp4\n'
        '\n'
        '# Upload + crear VOD automaticamente\n'
        'POST /api/v1/admin/media/upload-vod\n'
        '  Content-Type: multipart/form-data\n'
        '  Body: file=@pelicula.mp4, title=Mi Pelicula\n'
        '\n'
        '# Rate limit: 5 uploads por minuto por usuario'
    ))

    e.append(section('16.6 Compatibilidad Xtream Codes'))
    e.append(body('TIVIFY es compatible con reproductores IPTV que usan el protocolo Xtream Codes. Esto permite usar apps como IPTV Smarters, TiviMate, etc.'))
    e.append(code(
        '# Datos de conexion para reproductores IPTV:\n'
        'URL:      http://tu-servidor\n'
        'Username: (usuario TIVIFY)\n'
        'Password: (password TIVIFY)\n'
        '\n'
        '# Endpoints compatibles:\n'
        '  /player_api.php   - API principal\n'
        '  /xmltv.php        - Guia EPG\n'
        '  /live/user/pass/  - Streams en vivo\n'
        '  /movie/user/pass/ - VOD\n'
        '  /series/user/pass/- Series'
    ))

    e.append(PageBreak())
    return e


def build_chapter_17():
    """Troubleshooting."""
    e = []
    e.append(chapter('17. Troubleshooting'))

    e.append(section('17.1 Contenedor No Arranca'))
    e.append(code(
        '# Ver logs del contenedor que falla\n'
        'docker compose logs backend\n'
        '\n'
        '# Ver estado detallado\n'
        'docker inspect tivify-backend | grep -A 10 "State"\n'
        '\n'
        '# Causa comun: PostgreSQL no esta listo\n'
        '# Solucion: Verificar health checks\n'
        'docker compose ps'
    ))

    e.append(section('17.2 Error de Conexion a BD'))
    e.append(code(
        '# Verificar que PostgreSQL esta corriendo\n'
        'docker exec tivify-postgres pg_isready -U tivify\n'
        '\n'
        '# Verificar credenciales en .env\n'
        'grep DB_ .env\n'
        '\n'
        '# Ver logs de PostgreSQL\n'
        'docker compose logs postgres'
    ))

    e.append(section('17.3 Error de Conexion a Redis'))
    e.append(code(
        '# Verificar Redis\n'
        'docker exec tivify-redis redis-cli -a $REDIS_PASSWORD ping\n'
        '# Respuesta esperada: PONG\n'
        '\n'
        '# Ver memoria usada\n'
        'docker exec tivify-redis redis-cli -a $REDIS_PASSWORD INFO memory'
    ))

    e.append(section('17.4 Frontend No Carga'))
    e.append(code(
        '# Verificar que el frontend esta corriendo\n'
        'docker compose logs frontend\n'
        '\n'
        '# Verificar variables de entorno\n'
        'docker exec tivify-frontend printenv | grep NEXT_PUBLIC\n'
        '\n'
        '# Problema comun: BASE_URL incorrecto\n'
        '# NEXT_PUBLIC_API_URL debe apuntar a la URL publica'
    ))

    e.append(section('17.5 Streaming No Funciona'))
    e.append(code(
        '# Verificar FFmpeg\n'
        'docker exec tivify-backend ffmpeg -version\n'
        '\n'
        '# Verificar permisos del volumen media\n'
        'docker exec tivify-backend ls -la /media/\n'
        '\n'
        '# Verificar que nginx sirve los segmentos HLS\n'
        'curl -I http://localhost/media/hls/test/index.m3u8\n'
        '\n'
        '# Ver procesos FFmpeg activos\n'
        'docker exec tivify-backend ps aux | grep ffmpeg'
    ))

    e.append(section('17.6 APK Build Falla'))
    e.append(code(
        '# Verificar que VERSION existe\n'
        'cat VERSION\n'
        'cat android/VERSION  # Debe ser igual\n'
        '\n'
        '# Build con output verbose\n'
        'docker build --no-cache --progress=plain \\\n'
        '  -t tivify-android -f android/Dockerfile android/ 2>&1 | tee build.log\n'
        '\n'
        '# Causa comun: memoria insuficiente para Gradle\n'
        '# Solucion: Asignar al menos 4GB de RAM a Docker'
    ))

    e.append(section('17.7 Tailscale No Conecta'))
    e.append(code(
        '# Ver logs de Tailscale\n'
        'docker compose logs tailscale\n'
        '\n'
        '# Verificar auth key\n'
        '# Las claves efimeras expiran en 24h\n'
        '# Generar nueva en: https://login.tailscale.com/admin/settings/keys\n'
        '\n'
        '# Verificar que /dev/net/tun existe\n'
        'ls -la /dev/net/tun'
    ))

    e.append(PageBreak())
    return e


def build_chapter_18():
    """Referencia Rapida."""
    e = []
    e.append(chapter('18. Referencia Rapida'))

    e.append(section('18.1 Comandos Esenciales'))
    e.append(make_table(
        ['Accion', 'Comando'],
        [
            ['Levantar todo', 'cd docker && docker compose up -d'],
            ['Parar todo', 'cd docker && docker compose down'],
            ['Ver estado', 'cd docker && docker compose ps'],
            ['Ver logs', 'docker compose logs -f [servicio]'],
            ['Rebuild backend', 'docker compose up -d --build backend'],
            ['Rebuild frontend', 'docker compose up -d --build frontend'],
            ['Rebuild todo', 'docker compose up -d --build --force-recreate'],
            ['Health check', 'curl http://localhost/health'],
            ['Backup BD', 'docker exec tivify-postgres pg_dump -U tivify tivify > backup.sql'],
            ['Acceso psql', 'docker exec -it tivify-postgres psql -U tivify -d tivify'],
            ['Acceso Redis', 'docker exec -it tivify-redis redis-cli -a $REDIS_PASSWORD'],
            ['Frontend tests', 'cd frontend && npx jest'],
            ['Backend tests', 'MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/app" -w /app/backend golang:1.22 go test ./...'],
            ['Build APK', 'cp VERSION android/VERSION && docker build --no-cache -t tivify-android -f android/Dockerfile android/'],
            ['Limpiar Docker', 'docker system prune -f'],
        ],
        [4*cm, 13*cm]
    ))

    e.append(section('18.2 URLs Importantes'))
    e.append(make_table(
        ['URL', 'Descripcion'],
        [
            ['http://servidor/', 'Frontend (interfaz web)'],
            ['http://servidor/admin', 'Panel de administracion'],
            ['http://servidor/login', 'Pagina de login'],
            ['http://servidor/health', 'Health check (JSON)'],
            ['http://servidor/metrics', 'Metricas Prometheus'],
            ['http://servidor/api/version', 'Version del backend'],
            ['http://servidor/tivify.apk', 'Descarga de APK Android'],
            ['ws://servidor/ws?token=JWT', 'WebSocket tiempo real'],
        ],
        [7*cm, 10*cm]
    ))

    e.append(section('18.3 Credenciales por Defecto'))
    e.append(warning('CAMBIAR todas las credenciales por defecto antes de desplegar en produccion.'))
    e.append(make_table(
        ['Servicio', 'Usuario', 'Password', 'Fuente'],
        [
            ['Admin TIVIFY', 'admin', 'admin123', '.env (ADMIN_*)'],
            ['PostgreSQL', 'tivify', 'changeme', '.env (DB_*)'],
            ['Redis', '-', 'changeme', '.env (REDIS_PASSWORD)'],
        ],
        [4*cm, 3*cm, 4*cm, 6*cm]
    ))

    e.append(section('18.4 Limites de Recursos'))
    e.append(make_table(
        ['Servicio', 'CPU', 'RAM', 'Notas'],
        [
            ['PostgreSQL', '1 core', '1024 MB', 'max_connections=200, shared_buffers=256MB'],
            ['Redis', '0.5 core', '256 MB', 'Persistencia en disco'],
            ['Backend', '1 core', '512 MB', 'Incluye FFmpeg'],
            ['Frontend', '0.5 core', '256 MB', 'Next.js SSR'],
            ['nginx', '1 core', '256 MB', 'Rate limiting, static files'],
            ['TOTAL', '4 cores', '~2.3 GB', 'Minimo recomendado'],
        ],
        [3*cm, 2.5*cm, 2.5*cm, 9*cm]
    ))

    return e


# --- Page number footer ---
def add_page_number(canvas_obj, doc):
    """Add page number to each page."""
    page_num = canvas_obj.getPageNumber()
    if page_num > 1:  # Skip cover page
        text = f"TIVIFY Manual v2.4.0  |  Pagina {page_num}"
        canvas_obj.saveState()
        canvas_obj.setFont('Helvetica', 8)
        canvas_obj.setFillColor(HexColor('#94a3b8'))
        canvas_obj.drawString(2*cm, 1.2*cm, text)
        canvas_obj.drawRightString(A4[0] - 2*cm, 1.2*cm, "Marzo 2026")
        # Top line
        canvas_obj.setStrokeColor(BORDER)
        canvas_obj.setLineWidth(0.5)
        canvas_obj.line(2*cm, A4[1] - 1.5*cm, A4[0] - 2*cm, A4[1] - 1.5*cm)
        # Bottom line
        canvas_obj.line(2*cm, 1.5*cm, A4[0] - 2*cm, 1.5*cm)
        canvas_obj.restoreState()


def main():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        topMargin=2*cm,
        bottomMargin=2*cm,
        leftMargin=2*cm,
        rightMargin=2*cm,
        title='TIVIFY - Manual Completo v2.4.0',
        author='TIVIFY Team',
        subject='Manual de Desarrollo y Operaciones',
    )

    elements = []

    # Build all sections
    elements.extend(build_cover())
    elements.extend(build_toc())
    elements.extend(build_chapter_1())
    elements.extend(build_chapter_2())
    elements.extend(build_chapter_3())
    elements.extend(build_chapter_4())
    elements.extend(build_chapter_5())
    elements.extend(build_chapter_6())
    elements.extend(build_chapter_7())
    elements.extend(build_chapter_8())
    elements.extend(build_chapter_9())
    elements.extend(build_chapter_10())
    elements.extend(build_chapter_11())
    elements.extend(build_chapter_12())
    elements.extend(build_chapter_13())
    elements.extend(build_chapter_14())
    elements.extend(build_chapter_15())
    elements.extend(build_chapter_16())
    elements.extend(build_chapter_17())
    elements.extend(build_chapter_18())

    # Build PDF
    doc.build(elements, onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f"PDF generado: {OUTPUT_PATH}")
    print(f"Tamano: {os.path.getsize(OUTPUT_PATH) / 1024:.0f} KB")


if __name__ == '__main__':
    main()

# Android App

Native Android client built with Kotlin and Jetpack Compose, optimized for phones, tablets, and Android TV (Chromecast, smart TVs with remote controls).

## Features

- Live TV channel playback (HLS, MPEG-TS)
- Video on Demand with resume/continue-watching
- Series browsing with season/episode navigation
- Favorites and watch history
- EPG (Electronic Program Guide)
- Multi-server support with saved accounts
- D-pad/remote control navigation for TV
- Fullscreen player with gesture and key controls
- Responsive layout adapting to phone, tablet, and TV screens

## Architecture

**MVVM** with Hilt dependency injection:

```
UI (Compose) ← StateFlow ← ViewModel → Retrofit API
                                         ↓
                                    OkHttp Interceptors
                                    (Auth, BaseUrl, Unauthorized)
                                         ↓
                                      Server
```

### State Management

Each screen has a ViewModel exposing an immutable state via `StateFlow`:

```kotlin
data class ScreenState(
    val items: List<Item> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class ScreenViewModel @Inject constructor(
    private val api: TivifyApi
) : ViewModel() {
    private val _state = MutableStateFlow(ScreenState())
    val state: StateFlow<ScreenState> = _state
}
```

### HTTP Layer

Three OkHttp interceptors form the request pipeline:

1. **BaseUrlInterceptor** -- Replaces `http://localhost/` placeholder with the actual server URL
2. **AuthInterceptor** -- Injects `Authorization: Bearer <token>` header for server requests
3. **UnauthorizedInterceptor** -- Detects 401 responses and triggers logout (skips `/auth/` endpoints)

Interceptors use `@Volatile` cached values updated from the UI thread to avoid blocking DataStore reads on the network thread.

### Token Persistence

`TokenManager` uses Android DataStore for encrypted preferences:

- Access token, server URL, user profile
- Saved servers list (max 10, most recent first)
- Saved accounts for quick login
- `clear()` preserves saved servers and accounts

## Screens

| Screen | Description |
|--------|-------------|
| **Splash** | Animated logo with fade-in/scale effect |
| **Login** | Server URL + credentials, saved servers/accounts |
| **Home** | Continue watching, live channels, recent content |
| **Channels** | Live TV grid with category filters, 4 view modes |
| **VOD** | Movie catalog with search (400ms debounce) and pagination |
| **Series** | Series catalog with search and pagination |
| **VOD Detail** | Backdrop, metadata, play/resume button, favorite toggle |
| **Series Detail** | Season tabs, episode list, play per episode |
| **Player** | ExoPlayer with HLS, D-pad controls, TV safe area |
| **Favorites** | User's saved channels, VODs, and series |
| **History** | Watch history with progress indicators |
| **EPG** | Channel schedule by date |
| **Profile** | User info, email/password change, logout |

## TV/Remote Control Support

### Focus System

Custom `tvFocusable()` modifier provides visual feedback:
- Scale up to 1.08x on focus
- Glow border (3dp) with accent color
- Shadow elevation (12dp)
- 150ms animation with FastOutSlowInEasing

### D-pad Key Handling (Player)

| Key | Action |
|-----|--------|
| Center/Enter | Toggle play/pause (or show controls if hidden) |
| Left | Seek back 10 seconds |
| Right | Seek forward 10 seconds |
| Up/Down | Show controls, pass through for focus navigation |
| Back | Hide controls (if visible) or exit player |
| Media Play/Pause | Toggle playback |

### Safe Area

The player applies 48dp horizontal and 27dp vertical padding (5% overscan margins) to keep controls visible on TVs that crop edges.

### Custom TextField

`TvOutlinedTextField` prevents accidental keyboard popups on D-pad navigation:
- Read-only by default
- Enter/DpadCenter opens the keyboard
- Back/Escape closes it without losing focus

## Responsive Design

Layout adapts based on screen width:

| Device | Width | Behavior |
|--------|-------|----------|
| Phone | < 800dp | Compact cards, smaller fonts |
| Tablet | 800-1200dp | Medium cards |
| TV | > 1200dp | Large cards, larger fonts |

Grid columns adjust automatically using `GridCells.Adaptive`.

## Building the APK

### Via Docker (recommended)

```bash
# From project root
cp VERSION android/VERSION
docker build --no-cache -t tivify-android -f android/Dockerfile android/
docker create --name tivify-extract tivify-android
docker cp tivify-extract:/app/app/build/outputs/apk/debug/app-debug.apk ./tivify.apk
docker rm -f tivify-extract
```

### Verify

```bash
docker create --name verify tivify-android bash -c \
  '/opt/android-sdk/build-tools/35.0.0/aapt dump badging /tmp/app.apk 2>/dev/null | grep -E "versionCode|versionName"'
docker cp ./tivify.apk verify:/tmp/app.apk
docker start -a verify
docker rm -f verify
```

### Via Android Studio

1. Open the `android/` directory in Android Studio
2. Sync Gradle
3. Build > Build APK

## Versioning

- `VERSION` file at project root is the source of truth (semver: MAJOR.MINOR.PATCH)
- `versionCode` in `android/app/build.gradle.kts` is an integer, incremented with each release
- `build.gradle.kts` reads VERSION automatically

When releasing a new version:

1. Update `VERSION` (e.g., `2.4.0`)
2. Increment `versionCode` in `build.gradle.kts` (e.g., `5 → 6`)
3. Copy VERSION to `android/` before building

## Dependencies

| Library | Purpose |
|---------|---------|
| Jetpack Compose | Declarative UI |
| Hilt | Dependency injection |
| ExoPlayer (Media3) | Video playback (HLS, MPEG-TS) |
| Retrofit + OkHttp | HTTP client |
| Gson | JSON serialization |
| Coil | Image loading with caching |
| DataStore | Encrypted preferences |
| Navigation Compose | Screen routing |

## Configuration

Key constants in `util/Constants.kt`:

| Constant | Default | Description |
|----------|---------|-------------|
| `CONNECT_TIMEOUT` | 15s | HTTP connection timeout |
| `READ_TIMEOUT` | 15s | HTTP read timeout |
| `SEARCH_DEBOUNCE_MS` | 400ms | Search input debounce |
| `SEEK_INCREMENT_MS` | 10000ms | Player seek step |
| `CONTROLLER_TIMEOUT_MS` | 8000ms | Player controls auto-hide |
| `DEFAULT_PAGE_SIZE` | 20 | Items per page |
| `CHANNELS_PAGE_SIZE` | 50 | Channels per page |
| `TV_SAFE_HORIZONTAL` | 48dp | TV overscan horizontal margin |
| `TV_SAFE_VERTICAL` | 27dp | TV overscan vertical margin |

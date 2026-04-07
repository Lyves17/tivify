import axios from "axios";
import type {
  AuthResponse,
  Category,
  Channel,
  ChannelList,
  DashboardStats,
  EmissionStatus,
  EPGEntry,
  Favorite,
  ImportResponse,
  IPTVImportRequest,
  IPTVImportStatus,
  LibraryScanItem,
  LiveChannelsData,
  LocalMedia,
  PaginatedResponse,
  Playlist,
  ScanResponse,
  ScanStatusResponse,
  Series,
  SeriesWithCount,
  StorageDevice,
  Stream,
  TailscaleStatus,
  TailscaleAction,
  TMDBSearchResult,
  UploadDiagnostics,
  UserAdmin,
  VOD,
  VODDebugStats,
  WatchHistoryEntry,
} from "./types";
import { secureTokenStore } from "./secure-token-store";

type APIRes<T> = { success: boolean; data: T };
type PageRes<T> = PaginatedResponse<T>;

/**
 * Retry configuration for transient failures
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 10000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Request type interfaces for better type safety
 * (replaces Record<string, unknown> usage)
 */

interface CreateChannelRequest {
  name: string;
  category_id?: number;
  logo_url?: string;
  epg_channel_id?: string;
  channel_number?: number;
  is_active?: boolean;
}

interface UpdateChannelRequest {
  name?: string;
  category_id?: number;
  logo_url?: string;
  epg_channel_id?: string;
  channel_number?: number;
  is_active?: boolean;
}

interface CreateVODRequest {
  title: string;
  category_id?: number;
  poster_url?: string;
  backdrop_url?: string;
  description?: string;
  year?: number;
  duration?: number;
  rating?: number;
  is_active?: boolean;
}

interface UpdateVODRequest {
  title?: string;
  category_id?: number;
  poster_url?: string;
  backdrop_url?: string;
  description?: string;
  year?: number;
  duration?: number;
  rating?: number;
  is_active?: boolean;
}

interface CreateSeriesRequest {
  title: string;
  category_id?: number;
  poster_url?: string;
  backdrop_url?: string;
  description?: string;
  year?: number;
  is_active?: boolean;
}

interface UpdateSeriesRequest {
  title?: string;
  category_id?: number;
  poster_url?: string;
  backdrop_url?: string;
  description?: string;
  year?: number;
  is_active?: boolean;
}

// URL relativa para que pase por nginx (mismo origen, sin CORS)
const API_BASE_URL = "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // Default timeout: 30 seconds
});

// Validate JWT format: 3 base64url segments separated by dots
function isValidJWTFormat(token: string): boolean {
  const parts = token.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

/**
 * CSRF PROTECTION NOTE:
 * Do NOT use randomly generated CSRF tokens. They provide a false sense of security
 * because the token is generated on the client and is known to any attacker with JavaScript access.
 *
 * RECOMMENDED APPROACH (requires backend coordination):
 * - Use double-submit cookie pattern with backend-generated CSRF token
 * - Backend sets CSRF token in a readable cookie (not HttpOnly)
 * - Client reads cookie and sends it in X-CSRF-Token header
 * - Backend validates both cookie and header match
 *
 * CURRENT IMPLEMENTATION:
 * - Relies on SameSite cookies via HttpOnly refresh token
 * - All state-changing requests require authentication (JWT in Authorization header)
 * - Validates Origin header on backend for additional protection
 */

// Interceptor para agregar token JWT a cada request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = secureTokenStore.getToken();
    if (token && isValidJWTFormat(token)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  // Mark request as XMLHttpRequest for additional security context
  config.headers["X-Requested-With"] = "XMLHttpRequest";
  // Note: CSRF token from backend should be read from cookie and sent here (when backend supports it)

  return config;
});

// Token refresh rate limiting and queue management
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
let failedQueue: Array<{
  resolve: (value: string | null) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Calculate exponential backoff delay with jitter
 * @param attempt The retry attempt number (0-indexed)
 * @returns Delay in milliseconds
 */
function getExponentialBackoffDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
    RETRY_CONFIG.maxDelayMs
  );
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * delay * 0.1;
  return delay + jitter;
}

/**
 * Check if an error is retryable (transient failure)
 */
function isRetryableError(error: any): boolean {
  // Network timeout
  if (error.code === 'ECONNABORTED') return true;

  // HTTP status codes that indicate transient failures
  if (error.response?.status && RETRY_CONFIG.retryableStatusCodes.includes(error.response.status)) {
    return true;
  }

  return false;
}

// Interceptor para manejar 401 y renovar token con queue mechanism
// También maneja reintentos automáticos para errores transitorios
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle retryable errors (503, timeout, etc.) with exponential backoff
    if (isRetryableError(error) && !originalRequest._retryCount) {
      originalRequest._retryCount = 0;
    }

    if (isRetryableError(error) && originalRequest._retryCount < RETRY_CONFIG.maxRetries) {
      originalRequest._retryCount++;
      const delayMs = getExponentialBackoffDelay(originalRequest._retryCount - 1);
      console.warn(`Retrying request (${originalRequest._retryCount}/${RETRY_CONFIG.maxRetries}) after ${Math.round(delayMs)}ms:`, originalRequest.url);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return api(originalRequest);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing && refreshPromise) {
        // Queue subsequent requests while refresh is in progress
        return refreshPromise.then((token) => {
          if (token) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      // Create a promise that will resolve when token refresh completes
      refreshPromise = new Promise<string | null>(async (resolveRefresh) => {
        try {
          const { data } = await axios.post<{
            success: boolean;
            data: { access_token: string };
          }>(`${API_BASE_URL}/v1/auth/refresh`, {});

          const newToken = data.data.access_token;
          secureTokenStore.setToken(newToken);
          processQueue(null, newToken);
          resolveRefresh(newToken);
        } catch (refreshError) {
          processQueue(refreshError, null);
          // F18: Clear token from memory before redirect to login
          // This ensures the user won't see stale data if the page briefly loads before redirect
          secureTokenStore.clearToken();

          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }

          resolveRefresh(null);
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
          refreshPromise = null;
        }
      });

      return refreshPromise.then((token) => {
        if (token) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
        return Promise.reject(new Error("Token refresh failed"));
      });
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (username: string, password: string) =>
    api.post<{ success: boolean; data: AuthResponse }>("/v1/auth/login", {
      username,
      password,
    }),

  refresh: () =>
    api.post<{ success: boolean; data: { access_token: string } }>(
      "/v1/auth/refresh"
    ),

  logout: () => api.post("/v1/auth/logout"),

  me: () =>
    api.get<{ success: boolean; data: AuthResponse["user"] }>("/v1/auth/me"),
};

// Admin API
export const adminAPI = {
  // Dashboard
  getStats: () => api.get<APIRes<DashboardStats>>("/v1/admin/dashboard/stats"),

  // Categories
  getCategories: (page = 1, perPage = 50) =>
    api.get<PageRes<Category>>("/v1/admin/categories", { params: { page, per_page: perPage } }),
  getCategoriesByType: (type: string) =>
    api.get<APIRes<Category[]>>("/v1/admin/categories/by-type", { params: { type } }),
  createCategory: (data: Partial<Category>) =>
    api.post<APIRes<Category>>("/v1/admin/categories", data),
  updateCategory: (id: number, data: Partial<Category>) =>
    api.put<APIRes<Category>>(`/v1/admin/categories/${id}`, data),
  deleteCategory: (id: number) =>
    api.delete(`/v1/admin/categories/${id}`),

  // Channels
  getChannels: (page = 1, perPage = 20) =>
    api.get<PageRes<ChannelList>>("/v1/admin/channels", { params: { page, per_page: perPage } }),
  getChannel: (id: number) =>
    api.get<APIRes<Channel>>(`/v1/admin/channels/${id}`),
  createChannel: (data: CreateChannelRequest) =>
    api.post<APIRes<Channel>>("/v1/admin/channels", data),
  updateChannel: (id: number, data: UpdateChannelRequest) =>
    api.put<APIRes<Channel>>(`/v1/admin/channels/${id}`, data),
  deleteChannel: (id: number) =>
    api.delete(`/v1/admin/channels/${id}`),
  addStream: (channelId: number, data: Partial<Stream>) =>
    api.post<APIRes<Stream>>(`/v1/admin/channels/${channelId}/streams`, data),
  updateStream: (channelId: number, streamId: number, data: Partial<Stream>) =>
    api.put<APIRes<Stream>>(`/v1/admin/channels/${channelId}/streams/${streamId}`, data),
  deleteStream: (channelId: number, streamId: number) =>
    api.delete(`/v1/admin/channels/${channelId}/streams/${streamId}`),

  // VOD
  getVODs: (page = 1, perPage = 20) =>
    api.get<PageRes<VOD>>("/v1/admin/vod", { params: { page, per_page: perPage } }),
  getVOD: (id: number) =>
    api.get<APIRes<VOD>>(`/v1/admin/vod/${id}`),
  getVODDebugStats: () =>
    api.get<APIRes<VODDebugStats>>("/v1/admin/vod/debug"),
  createVOD: (data: CreateVODRequest) =>
    api.post<APIRes<VOD>>("/v1/admin/vod", data),
  updateVOD: (id: number, data: UpdateVODRequest) =>
    api.put<APIRes<VOD>>(`/v1/admin/vod/${id}`, data),
  deleteVOD: (id: number) =>
    api.delete(`/v1/admin/vod/${id}`),
  enrichVODs: () =>
    api.post<APIRes<{ enriched: number; failed: number; skipped: number }>>("/v1/admin/vod/enrich"),

  // Series
  getSeries: (page = 1, perPage = 20) =>
    api.get<PageRes<SeriesWithCount>>("/v1/admin/series", { params: { page, per_page: perPage } }),
  getSeriesById: (id: number) =>
    api.get<APIRes<Series>>(`/v1/admin/series/${id}`),
  createSeries: (data: CreateSeriesRequest) =>
    api.post<APIRes<Series>>("/v1/admin/series", data),
  updateSeries: (id: number, data: UpdateSeriesRequest) =>
    api.put<APIRes<Series>>(`/v1/admin/series/${id}`, data),
  deleteSeries: (id: number) =>
    api.delete(`/v1/admin/series/${id}`),
  enrichSeries: () =>
    api.post<APIRes<{ enriched: number; failed: number; skipped: number }>>("/v1/admin/series/enrich"),
  getSeriesEpisodes: (seriesId: number) =>
    api.get<APIRes<VOD[]>>(`/v1/series/${seriesId}/episodes`),

  // Users
  getUsers: (page = 1, perPage = 20) =>
    api.get<PageRes<UserAdmin>>("/v1/admin/users", { params: { page, per_page: perPage } }),
  getUser: (id: string) =>
    api.get<APIRes<UserAdmin>>(`/v1/admin/users/${id}`),
  createUser: (data: Record<string, unknown>) =>
    api.post<APIRes<UserAdmin>>("/v1/admin/users", data),
  updateUser: (id: string, data: Record<string, unknown>) =>
    api.put<APIRes<UserAdmin>>(`/v1/admin/users/${id}`, data),
  deleteUser: (id: string) =>
    api.delete(`/v1/admin/users/${id}`),

  // EPG
  getEPG: (page = 1, perPage = 20) =>
    api.get<PageRes<EPGEntry>>("/v1/admin/epg", { params: { page, per_page: perPage } }),
  createEPG: (data: Record<string, unknown>) =>
    api.post<APIRes<EPGEntry>>("/v1/admin/epg", data),
  updateEPG: (id: number, data: Record<string, unknown>) =>
    api.put<APIRes<EPGEntry>>(`/v1/admin/epg/${id}`, data),
  deleteEPG: (id: number) =>
    api.delete(`/v1/admin/epg/${id}`),

  // Local Media
  uploadMedia: (file: File, onProgress?: (pct: number) => void) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<APIRes<LocalMedia>>("/v1/admin/media/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 5 * 60 * 1000, // 5 minutes for large file uploads
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
  },
  uploadMediaWithVOD: (
    file: File,
    title: string,
    onProgress?: (pct: number) => void,
    seriesParams?: { series_id: number; season_number: number; episode_number: number }
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    if (title) formData.append("title", title);
    if (seriesParams) {
      formData.append("series_id", String(seriesParams.series_id));
      formData.append("season_number", String(seriesParams.season_number));
      formData.append("episode_number", String(seriesParams.episode_number));
    }
    return api.post<APIRes<VOD>>("/v1/admin/media/upload-vod", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 5 * 60 * 1000, // 5 minutes for large file uploads
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
  },
  getUploadDiagnostics: () =>
    api.get<APIRes<UploadDiagnostics>>("/v1/admin/media/diagnostics"),
  getMediaList: (page = 1, perPage = 20) =>
    api.get<PageRes<LocalMedia>>("/v1/admin/media", { params: { page, per_page: perPage } }),
  getMedia: (id: number) =>
    api.get<APIRes<LocalMedia>>(`/v1/admin/media/${id}`),
  deleteMedia: (id: number) =>
    api.delete(`/v1/admin/media/${id}`),
  createVODFromMedia: (mediaId: number, data: Record<string, unknown>) =>
    api.post<APIRes<VOD>>(`/v1/admin/media/${mediaId}/create-vod`, data),

  // Playlist (per channel)
  getChannelPlaylist: (channelId: number) =>
    api.get<APIRes<Playlist>>(`/v1/admin/channels/${channelId}/playlist`),
  addPlaylistItem: (channelId: number, data: { local_media_id: number; sort_order: number }) =>
    api.post<APIRes<Playlist>>(`/v1/admin/channels/${channelId}/playlist/items`, data),
  removePlaylistItem: (channelId: number, itemId: number) =>
    api.delete(`/v1/admin/channels/${channelId}/playlist/items/${itemId}`),
  reorderPlaylist: (channelId: number, items: { id: number; sort_order: number }[]) =>
    api.put(`/v1/admin/channels/${channelId}/playlist/reorder`, { items }),
  updatePlaylistMode: (channelId: number, playback_mode: string) =>
    api.put(`/v1/admin/channels/${channelId}/playlist/mode`, { playback_mode }),
  generatePlaylistStream: (channelId: number) =>
    api.post(`/v1/admin/channels/${channelId}/playlist/generate`),

  // Emission (emision en vivo con ffmpeg)
  startEmission: (channelId: number) =>
    api.post<APIRes<EmissionStatus>>(`/v1/admin/channels/${channelId}/emission/start`),
  stopEmission: (channelId: number) =>
    api.post(`/v1/admin/channels/${channelId}/emission/stop`),
  getEmissionStatus: (channelId: number) =>
    api.get<APIRes<EmissionStatus>>(`/v1/admin/channels/${channelId}/emission/status`),

  // IPTV Import
  iptvImport: (data: IPTVImportRequest) =>
    api.post<APIRes<{ message: string }>>("/v1/admin/iptv/import", data),
  iptvStatus: () =>
    api.get<APIRes<IPTVImportStatus>>("/v1/admin/iptv/status"),
  iptvDeleteBySource: (source = "iptv-org") =>
    api.delete(`/v1/admin/iptv/channels?source=${encodeURIComponent(source)}`),

  // Library Scanner
  getLibraryDevices: () =>
    api.get<APIRes<StorageDevice[]>>("/v1/admin/library/devices"),
  scanLibrary: (paths?: string[]) =>
    api.post<APIRes<ScanResponse>>("/v1/admin/library/scan", paths ? { paths } : {}),
  getScanStatus: (sessionId: string) =>
    api.get<APIRes<ScanStatusResponse>>(`/v1/admin/library/scan/${sessionId}/status`),
  getScanResults: (sessionId: string, page = 1, perPage = 50) =>
    api.get<PageRes<LibraryScanItem>>(`/v1/admin/library/scan/${sessionId}`, { params: { page, per_page: perPage } }),
  updateScanItem: (id: number, data: Record<string, unknown>) =>
    api.put<APIRes<LibraryScanItem>>(`/v1/admin/library/scan/items/${id}`, data),
  importLibraryItems: (sessionId: string, itemIds: number[]) =>
    api.post<APIRes<ImportResponse>>("/v1/admin/library/import", { session_id: sessionId, item_ids: itemIds }),
  searchTMDB: (query: string, year: number, mediaType: string) =>
    api.post<APIRes<TMDBSearchResult[]>>("/v1/admin/library/tmdb/search", { query, year, media_type: mediaType }),
  getTMDBStatus: () =>
    api.get<APIRes<{ configured: boolean; valid: boolean; message: string }>>("/v1/admin/library/tmdb/status"),

  // Tailscale (Docker container management)
  getTailscaleStatus: () =>
    api.get<APIRes<TailscaleStatus>>("/v1/admin/tailscale/status"),
  startTailscale: () =>
    api.post<APIRes<TailscaleAction>>("/v1/admin/tailscale/start"),
  stopTailscale: () =>
    api.post<APIRes<TailscaleAction>>("/v1/admin/tailscale/stop"),
  restartTailscale: () =>
    api.post<APIRes<TailscaleAction>>("/v1/admin/tailscale/restart"),
};

// User-facing API
export const userAPI = {
  // Catalogo
  getChannels: (page = 1, perPage = 20, search?: string, categoryId?: number) =>
    api.get<PageRes<ChannelList>>("/v1/channels", { params: { page, per_page: perPage, search, category_id: categoryId } }),
  getChannel: (id: number) =>
    api.get<APIRes<Channel>>(`/v1/channels/${id}`),
  getVODs: (page = 1, perPage = 20, search?: string, categoryId?: number) =>
    api.get<PageRes<VOD>>("/v1/vod", { params: { page, per_page: perPage, search, category_id: categoryId } }),
  getVOD: (id: number) =>
    api.get<APIRes<VOD>>(`/v1/vod/${id}`),
  getSeries: (page = 1, perPage = 20, search?: string, categoryId?: number) =>
    api.get<PageRes<SeriesWithCount>>("/v1/series", { params: { page, per_page: perPage, search, category_id: categoryId } }),
  getSeriesById: (id: number) =>
    api.get<APIRes<SeriesWithCount>>(`/v1/series/${id}`),
  getSeriesEpisodes: (seriesId: number) =>
    api.get<APIRes<VOD[]>>(`/v1/series/${seriesId}/episodes`),
  getCategories: (type: string) =>
    api.get<APIRes<Category[]>>("/v1/categories", { params: { type } }),
  getEPG: (channelId: number, date?: string) =>
    api.get<APIRes<EPGEntry[]>>("/v1/epg", { params: { channel_id: channelId, date } }),

  // Favoritos
  getFavorites: (page = 1, perPage = 20) =>
    api.get<PageRes<Favorite>>("/v1/favorites", { params: { page, per_page: perPage } }),
  toggleFavorite: (type: string, id: number) =>
    api.post<APIRes<{ added: boolean }>>("/v1/favorites/toggle", { type, id }),

  // Historial
  getHistory: (page = 1, perPage = 20) =>
    api.get<PageRes<WatchHistoryEntry>>("/v1/history", { params: { page, per_page: perPage } }),
  getContinueWatching: (limit = 10) =>
    api.get<APIRes<WatchHistoryEntry[]>>("/v1/history/continue", { params: { limit } }),
  recordHistory: (data: { content_type: string; content_id: number; progress: number; duration: number }) =>
    api.post("/v1/history", data),
  deleteHistory: (id: number) =>
    api.delete(`/v1/history/${id}`),

  // Busqueda global
  search: (q: string) =>
    api.get<APIRes<{ channels: ChannelList[]; vods: VOD[]; series: SeriesWithCount[] }>>("/v1/search", { params: { q } }),

  // Emisiones en vivo
  getLiveChannels: () =>
    api.get<APIRes<LiveChannelsData>>("/v1/emissions/live"),

  // Perfil
  updateProfile: (data: { email: string }) =>
    api.put("/v1/profile", data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.put("/v1/profile/password", data),
};

export default api;

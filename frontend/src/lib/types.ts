export interface User {
  id: string;
  username: string;
  email: string;
  role: "admin" | "user";
  is_active: boolean;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    per_page: number;
    pages: number;
  };
}

export interface Channel {
  id: number;
  name: string;
  slug: string;
  category_id: number | null;
  logo_url: string;
  epg_channel_id: string;
  channel_number: number | null;
  is_active: boolean;
  // "" = manual, "iptv-org" = importado, custom = otro
  source: string;
  streams?: Stream[];
  category?: Category;
}

export interface IPTVImportRequest {
  m3u_url?: string;
  epg_url?: string;
  countries?: string[];
  languages?: string[];
  categories?: string[];
  replace?: boolean;
  source?: string;
}

export interface IPTVImportStatus {
  running: boolean;
  total: number;
  current: number;
  percent: number;
  message: string;
  error?: string;
  imported: number;
}

export interface Stream {
  id: number;
  channel_id: number;
  url: string;
  stream_format: "hls" | "rtmp" | "mpegts";
  priority: number;
  is_active: boolean;
  user_agent: string;
  headers: string;
}

export interface VOD {
  id: number;
  title: string;
  slug: string;
  description: string;
  category_id: number | null;
  duration: number;
  poster_url: string;
  backdrop_url: string;
  hls_path: string;
  transcode_status: "pending" | "processing" | "completed" | "failed";
  transcode_progress: number;
  file_size: number;
  resolution: string;
  year: number;
  rating: number;
  is_active: boolean;
  series_id: number | null;
  season_number: number;
  episode_number: number;
  category?: Category;
}

export interface Series {
  id: number;
  title: string;
  slug: string;
  description: string;
  category_id: number | null;
  poster_url: string;
  backdrop_url: string;
  year: number;
  rating: number;
  total_seasons: number;
  is_active: boolean;
  episodes?: VOD[];
  category?: Category;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  type: "live" | "vod" | "series";
  parent_id: number | null;
  sort_order: number;
}

export interface EPGEntry {
  id: number;
  channel_id: number;
  channel_name?: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  category: string;
  language: string;
  episode_num: string;
  created_at?: string;
}

export interface ChannelList {
  id: number;
  name: string;
  slug: string;
  category_id: number | null;
  category?: Category;
  logo_url: string;
  epg_channel_id: string;
  channel_number: number | null;
  is_active: boolean;
  source: string;
  stream_count: number;
  created_at: string;
}

export interface SeriesWithCount extends Series {
  episodes_count: number;
  created_at?: string;
}

export interface UserAdmin {
  id: string;
  username: string;
  email: string;
  role: "admin" | "user";
  is_active: boolean;
  max_connections: number;
  exp_date: string | null;
  created_at: string;
}

export interface DashboardStats {
  channels: number;
  vods: number;
  series: number;
  users: number;
  recent_vods?: { id: number; title: string; transcode_status: string; transcode_progress: number; created_at: string }[];
  problem_vods?: { id: number; title: string; transcode_status: string; transcode_progress: number }[];
  recent_users?: { id: string; username: string; role: string; created_at: string }[];
}

export interface Favorite {
  id: number;
  favoritable_type: "channel" | "vod" | "series";
  favoritable_id: number;
  created_at: string;
  content_name: string;
  content_poster: string;
  content_slug: string;
}

export interface WatchHistoryEntry {
  id: number;
  content_type: "channel" | "vod";
  content_id: number;
  progress: number;
  duration: number;
  watched_at: string;
  content_name: string;
  content_poster: string;
  content_slug: string;
}

export interface LocalMedia {
  id: number;
  original_filename: string;
  file_path: string;
  hls_path: string;
  file_size: number;
  duration: number;
  resolution: string;
  mime_type: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  error_message: string;
  thumbnail_path: string;
  created_at: string;
}

export interface PlaylistItem {
  id: number;
  local_media_id: number;
  sort_order: number;
  local_media?: LocalMedia;
  created_at: string;
}

export interface Playlist {
  id: number;
  channel_id: number;
  playback_mode: "loop" | "once" | "shuffle";
  is_active: boolean;
  items: PlaylistItem[];
  created_at: string;
}

export interface EmissionStatus {
  channel_id: number;
  is_live: boolean;
  status: "stopped" | "starting" | "running" | "error";
  stream_url?: string;
  error?: string;
}

export interface LiveChannelsData {
  live_channel_ids: number[];
}

export interface LibraryScanItem {
  id: number;
  scan_session_id: string;
  file_name: string;
  file_size: number;
  parsed_title: string;
  parsed_year: number;
  media_type: "movie" | "series";
  season_number: number;
  episode_number: number;
  duration: number;
  resolution: string;
  video_codec: string;
  audio_codec: string;
  container: string;
  needs_transcode: boolean;
  direct_play_path: string;
  tmdb_id: number;
  tmdb_title: string;
  tmdb_year: number;
  tmdb_poster_url: string;
  tmdb_backdrop_url: string;
  tmdb_description: string;
  tmdb_rating: number;
  tmdb_series_name: string;
  import_status: "pending" | "imported" | "skipped" | "failed";
  imported_vod_id: number | null;
  imported_series_id: number | null;
  error_message: string;
  created_at: string;
}

export interface ScanResponse {
  session_id: string;
  status: string;
}

export interface ScanStatusResponse {
  session_id: string;
  status: "scanning" | "completed" | "failed";
  total_files: number;
  scanned: number;
  error?: string;
}

export interface ImportResponse {
  imported: number;
  failed: number;
}

export interface VODDebugProblem {
  id: number;
  title: string;
  is_active: boolean;
  series_id: number | null;
  transcode_status: string;
  hls_path: string;
  reason: string;
}

export interface VODDebugStats {
  total: number;
  active_standalone: number;
  active_episodes: number;
  inactive: number;
  visible_to_users: number;
  problems: VODDebugProblem[] | null;
}

export interface UploadDiagnostics {
  current_user: string;
  current_uid: string;
  ffmpeg_version: string;
  ffmpeg_ok: boolean;
  ffprobe_version: string;
  ffprobe_ok: boolean;
  media_path: string;
  directories: { path: string; exists: boolean; writable: boolean }[];
  disk_free_gb: number;
  disk_total_gb: number;
  recent_media: MediaDiag[] | null;
  pending_count: number;
  processing_count: number;
  completed_count: number;
  failed_count: number;
}

export interface MediaDiag {
  id: number;
  original_filename: string;
  file_path: string;
  file_exists: boolean;
  file_size_bytes: number;
  hls_path: string;
  hls_exists: boolean;
  status: string;
  progress: number;
  error_message: string;
  duration: number;
  resolution: string;
  thumbnail_path: string;
  created_at: string;
}

export interface TMDBSearchResult {
  id: number;
  title: string;
  overview: string;
  poster_url: string;
  backdrop_url: string;
  year: number;
  rating: number;
}

export interface StorageDevice {
  path: string;
  name: string;
  total_bytes: number;
  free_bytes: number;
  used_bytes: number;
  filesystem: string;
  video_files: number;
}

export interface TailscaleStatus {
  container: string;
  status: string;
  running: boolean;
  started_at?: string;
  finished_at?: string;
  error?: string;
  message?: string;
}

export interface TailscaleAction {
  container: string;
  action: string;
  message: string;
}

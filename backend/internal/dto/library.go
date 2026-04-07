package dto

import "time"

type ScanLibraryResponse struct {
	SessionID string `json:"session_id"`
	Status    string `json:"status"`
}

type ScanStatusResponse struct {
	SessionID  string `json:"session_id"`
	Status     string `json:"status"`
	TotalFiles int    `json:"total_files"`
	Scanned    int    `json:"scanned"`
	Error      string `json:"error,omitempty"`
}

type LibraryScanItemResponse struct {
	ID              uint      `json:"id"`
	ScanSessionID   string    `json:"scan_session_id"`
	FileName        string    `json:"file_name"`
	FileSize        int64     `json:"file_size"`
	ParsedTitle     string    `json:"parsed_title"`
	ParsedYear      int       `json:"parsed_year"`
	MediaType       string    `json:"media_type"`
	SeasonNumber    int       `json:"season_number"`
	EpisodeNumber   int       `json:"episode_number"`
	Duration        float64   `json:"duration"`
	Resolution      string    `json:"resolution"`
	VideoCodec      string    `json:"video_codec"`
	AudioCodec      string    `json:"audio_codec"`
	Container       string    `json:"container"`
	NeedsTranscode  bool      `json:"needs_transcode"`
	DirectPlayPath  string    `json:"direct_play_path"`
	TMDBId          int       `json:"tmdb_id"`
	TMDBTitle       string    `json:"tmdb_title"`
	TMDBYear        int       `json:"tmdb_year"`
	TMDBPosterURL   string    `json:"tmdb_poster_url"`
	TMDBBackdropURL string    `json:"tmdb_backdrop_url"`
	TMDBDescription string    `json:"tmdb_description"`
	TMDBRating      float64   `json:"tmdb_rating"`
	TMDBSeriesName  string    `json:"tmdb_series_name"`
	ImportStatus    string    `json:"import_status"`
	ImportedVODID   *uint     `json:"imported_vod_id"`
	ImportedSeriesID *uint    `json:"imported_series_id"`
	ErrorMessage    string    `json:"error_message"`
	CreatedAt       time.Time `json:"created_at"`
}

type UpdateScanItemRequest struct {
	ParsedTitle     string  `json:"parsed_title"`
	ParsedYear      int     `json:"parsed_year"`
	MediaType       string  `json:"media_type"`
	SeasonNumber    int     `json:"season_number"`
	EpisodeNumber   int     `json:"episode_number"`
	TMDBId          int     `json:"tmdb_id"`
	TMDBTitle       string  `json:"tmdb_title"`
	TMDBYear        int     `json:"tmdb_year"`
	TMDBPosterURL   string  `json:"tmdb_poster_url"`
	TMDBBackdropURL string  `json:"tmdb_backdrop_url"`
	TMDBDescription string  `json:"tmdb_description"`
	TMDBRating      float64 `json:"tmdb_rating"`
	TMDBSeriesName  string  `json:"tmdb_series_name"`
}

type ImportRequest struct {
	SessionID string `json:"session_id"`
	ItemIDs   []uint `json:"item_ids"`
}

type ImportResponse struct {
	Imported int `json:"imported"`
	Failed   int `json:"failed"`
}

type TMDBSearchRequest struct {
	Query     string `json:"query"`
	Year      int    `json:"year"`
	MediaType string `json:"media_type"` // movie or series
}

type TMDBSearchResponse struct {
	ID          int     `json:"id"`
	Title       string  `json:"title"`
	Overview    string  `json:"overview"`
	PosterURL   string  `json:"poster_url"`
	BackdropURL string  `json:"backdrop_url"`
	Year        int     `json:"year"`
	Rating      float64 `json:"rating"`
}

type StorageDevice struct {
	Path       string `json:"path"`
	Name       string `json:"name"`
	TotalBytes uint64 `json:"total_bytes"`
	FreeBytes  uint64 `json:"free_bytes"`
	UsedBytes  uint64 `json:"used_bytes"`
	FileSystem string `json:"filesystem"`
	VideoFiles int    `json:"video_files"`
}

type ScanRequest struct {
	Paths []string `json:"paths"`
}

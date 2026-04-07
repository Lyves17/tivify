package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/google/uuid"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/ws"
	"golang.org/x/sys/unix"
)

// errScanCancelled is returned when a scan is cancelled via context.
var errScanCancelled = errors.New("scan cancelled")

// B20: context.Context support added to ScanLibrary and runScan for cancellation.

// B3: Maximum results to return from library scan to prevent unbounded memory usage
const MaxScanResults = 10000

type ScanStatus struct {
	SessionID  string `json:"session_id"`
	Status     string `json:"status"` // scanning, completed, failed
	TotalFiles int    `json:"total_files"`
	Scanned    int    `json:"scanned"`
	Error      string `json:"error,omitempty"`
}

type LibraryScannerService struct {
	repo         LibraryScannerRepositoryInterface
	transcoder   *TranscoderService
	tmdb         *TMDBService
	vodRepo      VODRepositoryInterface
	seriesRepo   SeriesRepositoryInterface
	categoryRepo CategoryRepositoryInterface
	libraryPath  string
	mediaPath    string
	hub          *ws.Hub  // WebSocket hub for real-time scan progress events
	scanning     sync.Map // sessionID -> *ScanStatus
	cancels      sync.Map // sessionID -> context.CancelFunc
}

// SetHub sets the WebSocket hub for broadcasting scan progress events.
func (s *LibraryScannerService) SetHub(hub *ws.Hub) {
	s.hub = hub
}

func NewLibraryScannerService(
	repo LibraryScannerRepositoryInterface,
	transcoder *TranscoderService,
	tmdb *TMDBService,
	vodRepo VODRepositoryInterface,
	seriesRepo SeriesRepositoryInterface,
	categoryRepo CategoryRepositoryInterface,
	libraryPath string,
	mediaPath string,
) *LibraryScannerService {
	return &LibraryScannerService{
		repo:         repo,
		transcoder:   transcoder,
		tmdb:         tmdb,
		vodRepo:      vodRepo,
		seriesRepo:   seriesRepo,
		categoryRepo: categoryRepo,
		libraryPath:  libraryPath,
		mediaPath:    mediaPath,
	}
}

// Video file extensions
var videoExtensions = map[string]bool{
	".mp4": true, ".mkv": true, ".avi": true, ".mov": true,
	".wmv": true, ".flv": true, ".webm": true, ".m4v": true,
	".ts": true, ".mpg": true, ".mpeg": true, ".3gp": true,
}

// Series patterns: S01E02, 1x02
var seriesPatternSE = regexp.MustCompile(`(?i)(.+?)[.\s_-]+S(\d{1,2})E(\d{1,2})`)
var seriesPatternX = regexp.MustCompile(`(?i)(.+?)[.\s_-]+(\d{1,2})x(\d{1,2})`)

// Year pattern
var yearPattern = regexp.MustCompile(`[\(\[]?((?:19|20)\d{2})[\)\]]?`)

// Tags to clean from filenames
var cleanTags = regexp.MustCompile(`(?i)(1080p|720p|480p|2160p|4k|uhd|bluray|blu-ray|bdrip|brrip|dvdrip|dvdscr|hdtv|hdcam|webrip|web-dl|webdl|hdrip|remux|x264|x265|h264|h265|hevc|aac|ac3|dts|mp3|flac|multi|dual|latino|castellano|spanish|english|subs|sub|hdr|10bit|proper|repack|extended|unrated|director.?s?.?cut)\b`)
var separatorPattern = regexp.MustCompile(`[._]+`)
var multiDash = regexp.MustCompile(`-{2,}`)
var multiSpace = regexp.MustCompile(`\s{2,}`)

// ParseFilename extracts metadata from a filename
func ParseFilename(filename string) (title string, year int, mediaType string, season int, episode int) {
	// Remove extension
	name := strings.TrimSuffix(filename, filepath.Ext(filename))

	// Try series patterns first
	if matches := seriesPatternSE.FindStringSubmatch(name); len(matches) >= 4 {
		title = cleanTitle(matches[1])
		season, _ = strconv.Atoi(matches[2])
		episode, _ = strconv.Atoi(matches[3])
		mediaType = "series"
		// Try to extract year from the title part
		if ym := yearPattern.FindStringSubmatch(matches[1]); len(ym) >= 2 {
			year, _ = strconv.Atoi(ym[1])
		}
		return
	}
	if matches := seriesPatternX.FindStringSubmatch(name); len(matches) >= 4 {
		title = cleanTitle(matches[1])
		season, _ = strconv.Atoi(matches[2])
		episode, _ = strconv.Atoi(matches[3])
		mediaType = "series"
		if ym := yearPattern.FindStringSubmatch(matches[1]); len(ym) >= 2 {
			year, _ = strconv.Atoi(ym[1])
		}
		return
	}

	// Movie: extract year then clean title
	mediaType = "movie"
	if ym := yearPattern.FindStringSubmatch(name); len(ym) >= 2 {
		year, _ = strconv.Atoi(ym[1])
		// Take everything before the year as title
		idx := strings.Index(name, ym[0])
		if idx > 0 {
			title = cleanTitle(name[:idx])
		} else {
			title = cleanTitle(name)
		}
	} else {
		title = cleanTitle(name)
	}

	return
}

func cleanTitle(raw string) string {
	s := separatorPattern.ReplaceAllString(raw, " ")
	s = cleanTags.ReplaceAllString(s, "")
	s = multiDash.ReplaceAllString(s, " ")
	s = multiSpace.ReplaceAllString(s, " ")
	s = strings.TrimSpace(s)
	s = strings.Trim(s, "- ")
	// Title case
	words := strings.Fields(s)
	for i, w := range words {
		if len(w) > 0 {
			words[i] = strings.ToUpper(w[:1]) + strings.ToLower(w[1:])
		}
	}
	return strings.Join(words, " ")
}

// ProbeCodecs returns video/audio codec names using ffprobe
func ProbeCodecs(filePath string) (videoCodec, audioCodec string, err error) {
	// Video codec
	cmd := exec.Command("ffprobe",
		"-v", "error",
		"-select_streams", "v:0",
		"-show_entries", "stream=codec_name",
		"-of", "default=noprint_wrappers=1:nokey=1",
		filePath,
	)
	out, err := cmd.Output()
	if err != nil {
		return "", "", fmt.Errorf("ffprobe video codec: %w", err)
	}
	videoCodec = strings.TrimSpace(string(out))

	// Audio codec
	cmd = exec.Command("ffprobe",
		"-v", "error",
		"-select_streams", "a:0",
		"-show_entries", "stream=codec_name",
		"-of", "default=noprint_wrappers=1:nokey=1",
		filePath,
	)
	out, err = cmd.Output()
	if err != nil {
		// Some files may not have audio
		return videoCodec, "", nil
	}
	audioCodec = strings.TrimSpace(string(out))

	return videoCodec, audioCodec, nil
}

// ShouldTranscode determines if a file needs transcoding for browser playback
func ShouldTranscode(container, videoCodec, audioCodec string) bool {
	return !(strings.EqualFold(container, "mp4") &&
		strings.EqualFold(videoCodec, "h264") &&
		strings.EqualFold(audioCodec, "aac"))
}

// ScanLibrary starts an async library scan and returns the session ID.
// If paths is empty, scans the default libraryPath.
// B3: Scan results are limited to MaxScanResults to prevent unbounded memory usage.
// B20: Supports cancellation via CancelScan.
func (s *LibraryScannerService) ScanLibrary(paths []string) (string, error) {
	sessionID := uuid.New().String()

	status := &ScanStatus{
		SessionID: sessionID,
		Status:    "scanning",
	}
	s.scanning.Store(sessionID, status)

	// Validate and sanitize paths
	scanPaths := paths
	if len(scanPaths) == 0 {
		scanPaths = []string{s.libraryPath}
	} else {
		scanPaths = s.sanitizePaths(scanPaths)
		if len(scanPaths) == 0 {
			return "", fmt.Errorf("no valid paths provided")
		}
	}

	ctx, cancel := context.WithCancel(context.Background())
	s.cancels.Store(sessionID, cancel)

	go s.runScan(ctx, sessionID, status, scanPaths)

	return sessionID, nil
}

// CancelScan cancels a running scan by session ID.
func (s *LibraryScannerService) CancelScan(sessionID string) bool {
	if cancelFn, ok := s.cancels.LoadAndDelete(sessionID); ok {
		cancelFn.(context.CancelFunc)()
		return true
	}
	return false
}

func (s *LibraryScannerService) runScan(ctx context.Context, sessionID string, status *ScanStatus, paths []string) {
	defer func() {
		s.cancels.Delete(sessionID)
		if status.Status == "scanning" {
			status.Status = "completed"
		}
	}()

	log.Printf("[LibraryScanner] Scanning %d paths (session: %s)", len(paths), sessionID)

	for _, scanPath := range paths {
		// Check cancellation before each path
		if ctx.Err() != nil {
			status.Status = "cancelled"
			log.Printf("[LibraryScanner] Scan cancelled (session: %s)", sessionID)
			return
		}

		log.Printf("[LibraryScanner] Scanning path: %s", scanPath)

		err := filepath.Walk(scanPath, func(path string, info os.FileInfo, err error) error {
			// Check cancellation on each file
			if ctx.Err() != nil {
				return errScanCancelled
			}

			if err != nil {
				return nil // skip errors
			}
			if info.IsDir() {
				return nil
			}

			// B3: Stop scanning if we've reached the maximum results limit
			if status.TotalFiles >= MaxScanResults {
				log.Printf("[LibraryScanner] Maximum scan results (%d) reached, stopping scan", MaxScanResults)
				return filepath.SkipDir
			}

			ext := strings.ToLower(filepath.Ext(info.Name()))
			if !videoExtensions[ext] {
				return nil
			}

			status.TotalFiles++

			// Parse filename
			title, year, mediaType, season, episode := ParseFilename(info.Name())

			// Get container from extension
			container := strings.TrimPrefix(ext, ".")

			// Probe codecs and media info
			duration, resolution, _ := s.transcoder.ProbeMedia(path)
			videoCodec, audioCodec, _ := ProbeCodecs(path)

			needsTranscode := ShouldTranscode(container, videoCodec, audioCodec)

			// Build relative path for direct play
			relPath, _ := filepath.Rel(s.libraryPath, path)
			relPath = filepath.ToSlash(relPath) // normalize to forward slashes

			var directPlayPath string
			if !needsTranscode {
				directPlayPath = "/library/" + relPath
			}

			item := model.LibraryScanItem{
				ScanSessionID:  sessionID,
				FilePath:       path,
				FileName:       info.Name(),
				FileSize:       info.Size(),
				ParsedTitle:    title,
				ParsedYear:     year,
				MediaType:      mediaType,
				SeasonNumber:   season,
				EpisodeNumber:  episode,
				Duration:       duration,
				Resolution:     resolution,
				VideoCodec:     videoCodec,
				AudioCodec:     audioCodec,
				Container:      container,
				NeedsTranscode: needsTranscode,
				DirectPlayPath: directPlayPath,
				ImportStatus:   "pending",
			}

			// TMDB lookup
			if s.tmdb.IsConfigured() && title != "" {
				s.enrichWithTMDB(&item)
			}

			if err := s.repo.Create(&item); err != nil {
				log.Printf("[LibraryScanner] Error saving item %s: %v", info.Name(), err)
			}

			status.Scanned++

			// Broadcast scan progress via WebSocket every 5 files
			if s.hub != nil && status.Scanned%5 == 0 {
				s.hub.Broadcast(ws.Event{
					Type: "scan.progress",
					Data: map[string]interface{}{
						"session_id": sessionID,
						"found":      status.TotalFiles,
						"processed":  status.Scanned,
						"status":     "scanning",
					},
				})
			}

			return nil
		})

		if errors.Is(err, errScanCancelled) {
			status.Status = "cancelled"
			log.Printf("[LibraryScanner] Scan cancelled (session: %s)", sessionID)
			return
		}

		if err != nil {
			status.Status = "failed"
			status.Error = err.Error()
			log.Printf("[LibraryScanner] Scan failed for path %s: %v", scanPath, err)
			return
		}
	}

	log.Printf("[LibraryScanner] Scan completed: %d files found", status.TotalFiles)

	// Broadcast final scan status
	if s.hub != nil {
		s.hub.Broadcast(ws.Event{
			Type: "scan.progress",
			Data: map[string]interface{}{
				"session_id": sessionID,
				"found":      status.TotalFiles,
				"processed":  status.Scanned,
				"status":     status.Status,
			},
		})
	}
}

func (s *LibraryScannerService) enrichWithTMDB(item *model.LibraryScanItem) {
	var result *TMDBSearchResult
	var err error

	if item.MediaType == "series" {
		result, err = s.tmdb.SearchTV(item.ParsedTitle, item.ParsedYear)
	} else {
		result, err = s.tmdb.SearchMovie(item.ParsedTitle, item.ParsedYear)
	}

	if err != nil || result == nil {
		return
	}

	item.TMDBId = result.ID
	item.TMDBTitle = s.tmdb.GetTitle(result)
	item.TMDBYear = s.tmdb.GetYear(result)
	item.TMDBPosterURL = s.tmdb.PosterURL(result.PosterPath)
	item.TMDBBackdropURL = s.tmdb.BackdropURL(result.BackdropPath)
	item.TMDBDescription = result.Overview
	item.TMDBRating = result.VoteAverage
	if item.MediaType == "series" && result.Name != "" {
		item.TMDBSeriesName = result.Name
	}
}

// GetScanStatus returns the current scan status
func (s *LibraryScannerService) GetScanStatus(sessionID string) *ScanStatus {
	if val, ok := s.scanning.Load(sessionID); ok {
		return val.(*ScanStatus)
	}
	// Check if session exists in DB
	count, err := s.repo.CountBySessionID(sessionID)
	if err == nil && count > 0 {
		return &ScanStatus{
			SessionID:  sessionID,
			Status:     "completed",
			TotalFiles: int(count),
			Scanned:    int(count),
		}
	}
	return nil
}

// GetScanResults returns paginated results for a session
func (s *LibraryScannerService) GetScanResults(sessionID string, page, perPage int) ([]model.LibraryScanItem, int64, error) {
	return s.repo.FindBySessionID(sessionID, page, perPage)
}

// UpdateScanItem updates a scan item's metadata
func (s *LibraryScannerService) UpdateScanItem(id uint, updates map[string]interface{}) (*model.LibraryScanItem, error) {
	item, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("item no encontrado")
	}

	if v, ok := updates["parsed_title"].(string); ok && v != "" {
		item.ParsedTitle = v
	}
	if v, ok := updates["parsed_year"].(float64); ok {
		item.ParsedYear = int(v)
	}
	if v, ok := updates["media_type"].(string); ok && v != "" {
		item.MediaType = v
	}
	if v, ok := updates["season_number"].(float64); ok {
		item.SeasonNumber = int(v)
	}
	if v, ok := updates["episode_number"].(float64); ok {
		item.EpisodeNumber = int(v)
	}
	if v, ok := updates["tmdb_id"].(float64); ok {
		item.TMDBId = int(v)
	}
	if v, ok := updates["tmdb_title"].(string); ok {
		item.TMDBTitle = v
	}
	if v, ok := updates["tmdb_year"].(float64); ok {
		item.TMDBYear = int(v)
	}
	if v, ok := updates["tmdb_poster_url"].(string); ok {
		item.TMDBPosterURL = v
	}
	if v, ok := updates["tmdb_backdrop_url"].(string); ok {
		item.TMDBBackdropURL = v
	}
	if v, ok := updates["tmdb_description"].(string); ok {
		item.TMDBDescription = v
	}
	if v, ok := updates["tmdb_rating"].(float64); ok {
		item.TMDBRating = v
	}
	if v, ok := updates["tmdb_series_name"].(string); ok {
		item.TMDBSeriesName = v
	}

	if err := s.repo.Update(item); err != nil {
		return nil, fmt.Errorf("error actualizando item")
	}
	return item, nil
}

// SearchTMDB performs a manual TMDB search
func (s *LibraryScannerService) SearchTMDB(query string, year int, mediaType string) ([]TMDBSearchResult, error) {
	if !s.tmdb.IsConfigured() {
		return nil, fmt.Errorf("TMDB API key no configurada")
	}
	return s.tmdb.SearchMulti(query, year, mediaType)
}

// IsTMDBConfigured returns whether TMDB API is configured
func (s *LibraryScannerService) IsTMDBConfigured() bool {
	return s.tmdb.IsConfigured()
}

// ValidateTMDB validates the TMDB API key
func (s *LibraryScannerService) ValidateTMDB() error {
	return s.tmdb.ValidateAPIKey()
}

// sanitizePaths validates that paths are within allowed directories
func (s *LibraryScannerService) sanitizePaths(paths []string) []string {
	var sanitized []string
	allowedDirs := []string{"/library", "/host-mnt", "/host-media", "/host-run-media"}

	for _, p := range paths {
		// Resolve to absolute path
		absPath, err := filepath.Abs(p)
		if err != nil {
			log.Printf("[LibraryScanner] Invalid path %s: %v", p, err)
			continue
		}

		// Ensure it exists
		if _, err := os.Stat(absPath); err != nil {
			log.Printf("[LibraryScanner] Path does not exist %s: %v", absPath, err)
			continue
		}

		// Check if path is under allowed directories
		allowed := false
		for _, allowedDir := range allowedDirs {
			if strings.HasPrefix(absPath, allowedDir) {
				allowed = true
				break
			}
		}

		if !allowed {
			log.Printf("[LibraryScanner] Path not in allowed directories: %s", absPath)
			continue
		}

		sanitized = append(sanitized, absPath)
	}

	return sanitized
}

// ListStorageDevices scans for available storage devices
func (s *LibraryScannerService) ListStorageDevices() ([]dto.StorageDevice, error) {
	var devices []dto.StorageDevice

	// Check /library (mounted from host LIBRARY_PATH)
	devices = append(devices, s.scanDirectory("/library", "library-mount")...)

	// Check /host-mnt for mounted volumes
	devices = append(devices, s.scanDirectory("/host-mnt", "mnt")...)

	// Check /host-media for auto-mounted drives
	devices = append(devices, s.scanDirectory("/host-media", "media")...)

	// Check /host-run-media for systemd mounts
	devices = append(devices, s.scanDirectory("/host-run-media", "run-media")...)

	return devices, nil
}

func (s *LibraryScannerService) scanDirectory(basePath, prefix string) []dto.StorageDevice {
	var devices []dto.StorageDevice

	entries, err := os.ReadDir(basePath)
	if err != nil {
		log.Printf("[LibraryScanner] Cannot read %s: %v", basePath, err)
		return devices
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		dirPath := filepath.Join(basePath, entry.Name())

		// Get filesystem stats
		var stat unix.Statfs_t
		if err := unix.Statfs(dirPath, &stat); err != nil {
			log.Printf("[LibraryScanner] Cannot statfs %s: %v", dirPath, err)
			continue
		}

		// Calculate sizes
		blockSize := uint64(stat.Bsize)
		totalBytes := int64(stat.Blocks) * int64(blockSize)
		freeBytes := int64(stat.Bavail) * int64(blockSize)
		usedBytes := totalBytes - (int64(stat.Bfree) * int64(blockSize))

		// Count video files in this directory
		videoCount := s.countVideoFiles(dirPath)

		// Only include if it has video files or is a significant mount
		if videoCount > 0 {
			fs := "unknown"
			if stat.Type != 0 {
				// Try to identify filesystem type (simplified)
				fsType := stat.Type
				switch fsType {
				case 0x4d44: // MSDOS_SUPER_MAGIC
					fs = "FAT"
				case 0xEF53: // EXT2_SUPER_MAGIC
					fs = "EXT"
				case 0x9123683E: // BTRFS_SUPER_MAGIC
					fs = "BTRFS"
				case 0x52654973: // REISERFS_SUPER_MAGIC
					fs = "REISERFS"
				case 0x517B: // SMB_SUPER_MAGIC
					fs = "SMB"
				default:
					fs = fmt.Sprintf("0x%x", fsType)
				}
			}

			device := dto.StorageDevice{
				Path:       dirPath,
				Name:       fmt.Sprintf("%s/%s", prefix, entry.Name()),
				TotalBytes: uint64(totalBytes),
				FreeBytes:  uint64(freeBytes),
				UsedBytes:  uint64(usedBytes),
				FileSystem: fs,
				VideoFiles: videoCount,
			}
			devices = append(devices, device)
		}
	}

	return devices
}

func (s *LibraryScannerService) countVideoFiles(dirPath string) int {
	count := 0
	err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(info.Name()))
		if videoExtensions[ext] {
			count++
		}
		return nil
	})

	if err != nil {
		log.Printf("[LibraryScanner] Error scanning %s: %v", dirPath, err)
	}
	return count
}

// ImportItems imports selected scan items as VODs/Series
func (s *LibraryScannerService) ImportItems(sessionID string, itemIDs []uint) (imported int, failed int, err error) {
	items, err := s.repo.FindByIDs(itemIDs)
	if err != nil {
		return 0, 0, fmt.Errorf("error buscando items")
	}

	// Track series by TMDB ID or title for grouping
	seriesMap := make(map[string]*model.Series) // key: tmdb_id or title

	for i := range items {
		item := &items[i]
		if item.ImportStatus == "imported" {
			continue
		}

		if item.MediaType == "series" {
			err := s.importSeriesEpisode(item, seriesMap)
			if err != nil {
				failed++
				s.repo.UpdateImportStatus(item.ID, "failed", nil, nil, err.Error())
				log.Printf("[LibraryScanner] Import failed for %s: %v", item.FileName, err)
			} else {
				imported++
			}
		} else {
			err := s.importMovie(item)
			if err != nil {
				failed++
				s.repo.UpdateImportStatus(item.ID, "failed", nil, nil, err.Error())
				log.Printf("[LibraryScanner] Import failed for %s: %v", item.FileName, err)
			} else {
				imported++
			}
		}
	}

	return imported, failed, nil
}

func (s *LibraryScannerService) importMovie(item *model.LibraryScanItem) error {
	title := item.TMDBTitle
	if title == "" {
		title = item.ParsedTitle
	}
	if title == "" {
		title = item.FileName
	}

	year := item.TMDBYear
	if year == 0 {
		year = item.ParsedYear
	}

	slug := generateSlug(title)

	// Determine HLS path
	hlsPath := item.DirectPlayPath
	transcodeStatus := "completed"
	if item.NeedsTranscode {
		hlsPath = ""
		transcodeStatus = "pending"
	}

	// Find or create VOD category
	var categoryID *uint
	categoryID = s.findOrCreateCategory("Peliculas", "vod")

	vod := &model.VOD{
		Title:           title,
		Slug:            slug,
		Description:     item.TMDBDescription,
		CategoryID:      categoryID,
		Duration:        int(item.Duration),
		PosterURL:       item.TMDBPosterURL,
		BackdropURL:     item.TMDBBackdropURL,
		HLSPath:         hlsPath,
		TranscodeStatus: transcodeStatus,
		FileSize:        item.FileSize,
		Resolution:      item.Resolution,
		Year:            year,
		Rating:          item.TMDBRating,
		IsActive:        true,
	}

	if err := s.vodRepo.Create(vod); err != nil {
		return fmt.Errorf("error creando VOD: %w", err)
	}

	// If needs transcoding, start it
	if item.NeedsTranscode {
		s.startTranscodeForImport(item.FilePath, vod.ID)
	}

	s.repo.UpdateImportStatus(item.ID, "imported", &vod.ID, nil, "")
	return nil
}

func (s *LibraryScannerService) importSeriesEpisode(item *model.LibraryScanItem, seriesMap map[string]*model.Series) error {
	// Determine series key for grouping
	seriesKey := ""
	if item.TMDBId > 0 {
		seriesKey = fmt.Sprintf("tmdb_%d", item.TMDBId)
	} else {
		seriesKey = "title_" + strings.ToLower(item.ParsedTitle)
	}

	// Find or create the series
	series, exists := seriesMap[seriesKey]
	if !exists {
		seriesTitle := item.TMDBSeriesName
		if seriesTitle == "" {
			seriesTitle = item.TMDBTitle
		}
		if seriesTitle == "" {
			seriesTitle = item.ParsedTitle
		}

		seriesYear := item.TMDBYear
		if seriesYear == 0 {
			seriesYear = item.ParsedYear
		}

		categoryID := s.findOrCreateCategory("Series", "series")

		series = &model.Series{
			Title:        seriesTitle,
			Slug:         generateSlug(seriesTitle),
			Description:  item.TMDBDescription,
			CategoryID:   categoryID,
			PosterURL:    item.TMDBPosterURL,
			BackdropURL:  item.TMDBBackdropURL,
			Year:         seriesYear,
			Rating:       item.TMDBRating,
			TotalSeasons: item.SeasonNumber,
			IsActive:     true,
		}

		if err := s.seriesRepo.Create(series); err != nil {
			return fmt.Errorf("error creando serie: %w", err)
		}
		seriesMap[seriesKey] = series
	} else {
		// Update total seasons if higher
		if item.SeasonNumber > series.TotalSeasons {
			series.TotalSeasons = item.SeasonNumber
			s.seriesRepo.Update(series)
		}
	}

	// Create VOD for the episode
	title := item.TMDBTitle
	if title == "" {
		title = item.ParsedTitle
	}

	episodeTitle := fmt.Sprintf("%s S%02dE%02d", title, item.SeasonNumber, item.EpisodeNumber)
	slug := generateSlug(episodeTitle)

	hlsPath := item.DirectPlayPath
	transcodeStatus := "completed"
	if item.NeedsTranscode {
		hlsPath = ""
		transcodeStatus = "pending"
	}

	vod := &model.VOD{
		Title:           episodeTitle,
		Slug:            slug,
		Description:     item.TMDBDescription,
		Duration:        int(item.Duration),
		PosterURL:       item.TMDBPosterURL,
		BackdropURL:     item.TMDBBackdropURL,
		HLSPath:         hlsPath,
		TranscodeStatus: transcodeStatus,
		FileSize:        item.FileSize,
		Resolution:      item.Resolution,
		Year:            item.TMDBYear,
		Rating:          item.TMDBRating,
		IsActive:        true,
		SeriesID:        &series.ID,
		SeasonNumber:    item.SeasonNumber,
		EpisodeNumber:   item.EpisodeNumber,
	}

	if err := s.vodRepo.Create(vod); err != nil {
		return fmt.Errorf("error creando episodio: %w", err)
	}

	if item.NeedsTranscode {
		s.startTranscodeForImport(item.FilePath, vod.ID)
	}

	s.repo.UpdateImportStatus(item.ID, "imported", &vod.ID, &series.ID, "")
	return nil
}

func (s *LibraryScannerService) findOrCreateCategory(name, catType string) *uint {
	// Try to find existing category
	cats, err := s.categoryRepo.ListByType(catType)
	if err == nil {
		for _, c := range cats {
			if strings.EqualFold(c.Name, name) {
				return &c.ID
			}
		}
	}

	// Create new category
	cat := &model.Category{
		Name:      name,
		Slug:      generateSlug(name),
		Type:      catType,
		SortOrder: 0,
	}
	if err := s.categoryRepo.Create(cat); err != nil {
		return nil
	}
	return &cat.ID
}

func (s *LibraryScannerService) startTranscodeForImport(filePath string, vodID uint) {
	// Create a local media entry for the transcoder
	lm := &model.LocalMedia{
		OriginalFilename: filepath.Base(filePath),
		FilePath:         filePath,
		Status:           "pending",
	}

	// Probe to get duration
	duration, _, _ := s.transcoder.ProbeMedia(filePath)
	lm.Duration = duration

	if err := s.transcoder.mediaRepo.Create(lm); err != nil {
		log.Printf("[LibraryScanner] Error creating local media for transcode: %v", err)
		return
	}

	// Transcode and update the VOD record when done
	s.transcoder.TranscodeToHLSWithCallback(lm, func(hlsPath string, transcodeErr error) {
		vod, err := s.vodRepo.FindByID(vodID)
		if err != nil {
			log.Printf("[LibraryScanner] Error finding VOD %d after transcode: %v", vodID, err)
			return
		}
		if transcodeErr != nil {
			vod.TranscodeStatus = "failed"
			s.vodRepo.Update(vod)
			return
		}
		vod.HLSPath = hlsPath
		vod.TranscodeStatus = "completed"
		vod.TranscodeProgress = 100
		if updateErr := s.vodRepo.Update(vod); updateErr != nil {
			log.Printf("[LibraryScanner] Error updating VOD %d with HLS path: %v", vodID, updateErr)
		} else {
			log.Printf("[LibraryScanner] VOD %d updated with HLS path: %s", vodID, hlsPath)
		}
	})
}

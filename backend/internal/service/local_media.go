package service

import (
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
)

var allowedVideoExtensions = map[string]bool{
	".mp4":  true,
	".mkv":  true,
	".avi":  true,
	".webm": true,
	".mov":  true,
	".flv":  true,
	".ts":   true,
	".m4v":  true,
	".wmv":  true,
}

// Allowed MIME types for video uploads
var allowedVideoMimeTypes = map[string]bool{
	"video/mp4":              true,
	"video/x-matroska":       true,
	"video/x-msvideo":        true,
	"video/webm":             true,
	"video/quicktime":        true,
	"video/x-flv":            true,
	"video/mp2t":             true,
	"video/x-m4v":            true,
	"video/x-ms-wmv":         true,
	"application/octet-stream": true, // Fallback for unknown video types
}

type LocalMediaService struct {
	repo        LocalMediaRepositoryInterface
	transcoder  *TranscoderService
	vodService  *VODService
	mediaPath   string
}

func NewLocalMediaService(repo LocalMediaRepositoryInterface, transcoder *TranscoderService, vodService *VODService, mediaPath string) *LocalMediaService {
	return &LocalMediaService{
		repo:       repo,
		transcoder: transcoder,
		vodService: vodService,
		mediaPath:  mediaPath,
	}
}

func (s *LocalMediaService) Upload(fileHeader *multipart.FileHeader) (*dto.LocalMediaResponse, error) {
	// Validate extension
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if !allowedVideoExtensions[ext] {
		return nil, fmt.Errorf("formato no soportado: %s. Formatos permitidos: mp4, mkv, avi, webm, mov, flv, ts, m4v, wmv", ext)
	}

	// Generate unique filename
	uniqueName := uuid.New().String() + ext
	savePath := filepath.Join(s.mediaPath, "uploads", uniqueName)

	// Open uploaded file
	src, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("error abriendo archivo: %w", err)
	}
	defer src.Close()

	// Detect MIME type from file content (not just extension)
	buffer := make([]byte, 512)
	n, err := src.Read(buffer)
	if err != nil && err != io.EOF {
		return nil, fmt.Errorf("error reading file for MIME type detection: %w", err)
	}

	detectedMimeType := http.DetectContentType(buffer[:n])
	if !isValidVideoMimeType(detectedMimeType) {
		log.Printf("WARNING: Detected MIME type %s for file %s does not match expected video types", detectedMimeType, fileHeader.Filename)
		// Continue anyway but log warning - some video formats may not be correctly detected
	}

	// Reset reader position for actual copy
	src.Seek(0, io.SeekStart)

	// Create destination file
	dst, err := os.Create(savePath)
	if err != nil {
		return nil, fmt.Errorf("error creando archivo: %w", err)
	}
	defer dst.Close()

	// Cleanup partial file on error
	uploadOK := false
	defer func() {
		if !uploadOK {
			os.Remove(savePath)
		}
	}()

	// Copy content
	written, copyErr := io.Copy(dst, src)
	if copyErr != nil {
		return nil, fmt.Errorf("error copiando archivo: %w", copyErr)
	}
	// Ensure data is flushed to disk before proceeding
	if err := dst.Sync(); err != nil {
		return nil, fmt.Errorf("error sincronizando archivo: %w", err)
	}
	uploadOK = true

	// Probe media for duration and resolution
	duration, resolution, probeErr := s.transcoder.ProbeMedia(savePath)
	if probeErr != nil {
		// Don't fail - just log it, we can still transcode
		duration = 0
		resolution = ""
	}

	// Generate thumbnail
	thumbnailDir := filepath.Join(s.mediaPath, "thumbnails")
	os.MkdirAll(thumbnailDir, 0755)
	thumbnailName := uuid.New().String() + ".jpg"
	thumbnailPath := filepath.Join(thumbnailDir, thumbnailName)
	thumbnailURL := ""
	if err := s.transcoder.GenerateThumbnail(savePath, thumbnailPath, duration); err == nil {
		thumbnailURL = "/media/thumbnails/" + thumbnailName
	}

	// Detect mime type from extension
	mimeType := "video/mp4"
	switch ext {
	case ".mkv":
		mimeType = "video/x-matroska"
	case ".avi":
		mimeType = "video/x-msvideo"
	case ".webm":
		mimeType = "video/webm"
	case ".mov":
		mimeType = "video/quicktime"
	case ".flv":
		mimeType = "video/x-flv"
	case ".ts":
		mimeType = "video/mp2t"
	case ".m4v":
		mimeType = "video/x-m4v"
	case ".wmv":
		mimeType = "video/x-ms-wmv"
	}

	// Create record
	media := &model.LocalMedia{
		OriginalFilename: fileHeader.Filename,
		FilePath:         savePath,
		FileSize:         written,
		Duration:         duration,
		Resolution:       resolution,
		MimeType:         mimeType,
		Status:           "pending",
		Progress:         0,
		ThumbnailPath:    thumbnailURL,
	}

	if err := s.repo.Create(media); err != nil {
		os.Remove(savePath)
		return nil, fmt.Errorf("error guardando registro: %w", err)
	}

	// Start transcoding in background
	s.transcoder.TranscodeToHLS(media)

	return toLocalMediaResponse(media), nil
}

// UploadDirect sube un archivo sin transcodificar y crea un VOD directamente.
// El archivo se guarda tal cual en /media/uploads/ y se sirve en plano.
func (s *LocalMediaService) UploadDirect(fileHeader *multipart.FileHeader, title string, seriesID *uint, seasonNumber int, episodeNumber int) (*dto.VODResponse, error) {
	log.Printf("[UPLOAD-DIRECT] === INICIO === archivo=%s size=%d title=%s series_id=%v season=%d episode=%d", fileHeader.Filename, fileHeader.Size, title, seriesID, seasonNumber, episodeNumber)

	// Step 1: Validate extension
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if !allowedVideoExtensions[ext] {
		log.Printf("[UPLOAD-DIRECT] FAIL step=1-extension ext=%s", ext)
		return nil, fmt.Errorf("formato no soportado: %s", ext)
	}
	log.Printf("[UPLOAD-DIRECT] OK step=1-extension ext=%s", ext)

	// Step 2: Generate path
	uniqueName := uuid.New().String() + ext
	savePath := filepath.Join(s.mediaPath, "uploads", uniqueName)
	log.Printf("[UPLOAD-DIRECT] OK step=2-path savePath=%s", savePath)

	// Step 3: Check uploads dir exists
	uploadsDir := filepath.Join(s.mediaPath, "uploads")
	if info, err := os.Stat(uploadsDir); err != nil {
		log.Printf("[UPLOAD-DIRECT] WARN step=3-dir uploads dir no existe, creando: %v", err)
		if mkErr := os.MkdirAll(uploadsDir, 0755); mkErr != nil {
			log.Printf("[UPLOAD-DIRECT] FAIL step=3-dir no se pudo crear: %v", mkErr)
			return nil, fmt.Errorf("error creando directorio uploads: %w", mkErr)
		}
	} else {
		log.Printf("[UPLOAD-DIRECT] OK step=3-dir uploads dir existe isDir=%v", info.IsDir())
	}

	// Step 4: Open uploaded file
	src, err := fileHeader.Open()
	if err != nil {
		log.Printf("[UPLOAD-DIRECT] FAIL step=4-open error abriendo archivo: %v", err)
		return nil, fmt.Errorf("error abriendo archivo: %w", err)
	}
	defer src.Close()
	log.Printf("[UPLOAD-DIRECT] OK step=4-open archivo abierto")

	// Step 5: Create destination file
	dst, err := os.Create(savePath)
	if err != nil {
		log.Printf("[UPLOAD-DIRECT] FAIL step=5-create error creando archivo destino: %v", err)
		return nil, fmt.Errorf("error creando archivo: %w", err)
	}
	defer dst.Close()
	log.Printf("[UPLOAD-DIRECT] OK step=5-create archivo destino creado")

	uploadOK := false
	defer func() {
		if !uploadOK {
			log.Printf("[UPLOAD-DIRECT] CLEANUP eliminando archivo parcial %s", savePath)
			os.Remove(savePath)
		}
	}()

	// Step 6: Copy content
	written, copyErr := io.Copy(dst, src)
	if copyErr != nil {
		log.Printf("[UPLOAD-DIRECT] FAIL step=6-copy error copiando: %v (written=%d)", copyErr, written)
		return nil, fmt.Errorf("error copiando archivo: %w", copyErr)
	}
	log.Printf("[UPLOAD-DIRECT] OK step=6-copy %d bytes copiados", written)

	// Step 7: Sync to disk
	if err := dst.Sync(); err != nil {
		log.Printf("[UPLOAD-DIRECT] FAIL step=7-sync error sincronizando: %v", err)
		return nil, fmt.Errorf("error sincronizando archivo: %w", err)
	}
	uploadOK = true
	log.Printf("[UPLOAD-DIRECT] OK step=7-sync archivo guardado en disco")

	// Step 8: Verify file exists and size
	if fi, err := os.Stat(savePath); err == nil {
		log.Printf("[UPLOAD-DIRECT] OK step=8-verify archivo existe size=%d", fi.Size())
	} else {
		log.Printf("[UPLOAD-DIRECT] WARN step=8-verify no se pudo verificar: %v", err)
	}

	// Step 9: Probe duration/resolution (optional, no falla si no funciona)
	duration, resolution, probeErr := s.transcoder.ProbeMedia(savePath)
	if probeErr != nil {
		log.Printf("[UPLOAD-DIRECT] WARN step=9-probe error (no critico): %v", probeErr)
	} else {
		log.Printf("[UPLOAD-DIRECT] OK step=9-probe duration=%.1fs resolution=%s", duration, resolution)
	}

	// Step 10: Thumbnail
	thumbnailURL := ""
	thumbnailDir := filepath.Join(s.mediaPath, "thumbnails")
	os.MkdirAll(thumbnailDir, 0755)
	thumbName := uuid.New().String() + ".jpg"
	thumbPath := filepath.Join(thumbnailDir, thumbName)
	if err := s.transcoder.GenerateThumbnail(savePath, thumbPath, duration); err == nil {
		thumbnailURL = "/media/thumbnails/" + thumbName
		log.Printf("[UPLOAD-DIRECT] OK step=10-thumbnail %s", thumbnailURL)
	} else {
		log.Printf("[UPLOAD-DIRECT] WARN step=10-thumbnail error (no critico): %v", err)
	}

	// Step 11: Check browser compatibility
	browserOK := s.transcoder.IsBrowserCompatible(savePath)
	log.Printf("[UPLOAD-DIRECT] step=11-compat browserCompatible=%v ext=%s", browserOK, ext)

	// Determine initial stream URL and transcode status
	streamURL := "/media/uploads/" + uniqueName
	transcodeStatus := "completed"
	if !browserOK {
		// File needs transcoding — VOD will start as "processing"
		transcodeStatus = "processing"
		log.Printf("[UPLOAD-DIRECT] Archivo NO compatible con navegador, se transcodificará a MP4")
	}

	// Step 12: Create VOD
	isActive := true
	vodReq := dto.CreateVODRequest{
		Title:         title,
		Duration:      int(duration),
		HLSPath:       streamURL,
		PosterURL:     thumbnailURL,
		BackdropURL:   thumbnailURL,
		IsActive:      &isActive,
		SeriesID:      seriesID,
		SeasonNumber:  seasonNumber,
		EpisodeNumber: episodeNumber,
	}
	// If we'll transcode, temporarily set HLSPath empty so it's marked pending
	if !browserOK {
		vodReq.HLSPath = "" // VOD create will set status=pending, we'll override to processing
	}
	log.Printf("[UPLOAD-DIRECT] step=12-vod creando VOD title=%s streamURL=%s transcode=%s", title, streamURL, transcodeStatus)

	vod, err := s.vodService.Create(vodReq)
	if err != nil {
		log.Printf("[UPLOAD-DIRECT] FAIL step=12-vod error creando VOD: %v", err)
		return nil, fmt.Errorf("error creando VOD: %w", err)
	}
	log.Printf("[UPLOAD-DIRECT] OK step=12-vod VOD creado id=%d", vod.ID)

	// Step 13: Update file info
	s.vodService.UpdateFileInfo(vod.ID, fileHeader.Filename, resolution, written)

	if !browserOK {
		// Set to processing and start background transcode
		s.vodService.UpdateTranscodeStatus(vod.ID, "processing", 0, "")

		// Transcode to MP4 in background
		mp4Name := uuid.New().String() + ".mp4"
		mp4Path := filepath.Join(s.mediaPath, "uploads", mp4Name)
		mp4URL := "/media/uploads/" + mp4Name
		vodID := vod.ID

		s.transcoder.TranscodeToMP4(savePath, mp4Path, duration,
			func(pct int) {
				// Update progress
				s.vodService.UpdateTranscodeStatus(vodID, "processing", pct, "")
			},
			func(err error) {
				if err != nil {
					log.Printf("[UPLOAD-DIRECT] FAIL transcode vod_id=%d: %v", vodID, err)
					s.vodService.UpdateTranscodeStatus(vodID, "failed", 0, "")
					return
				}
				// Transcode done — update VOD to point to the MP4
				log.Printf("[UPLOAD-DIRECT] OK transcode vod_id=%d -> %s", vodID, mp4URL)
				s.vodService.UpdateTranscodeStatus(vodID, "completed", 100, mp4URL)
			},
		)
		log.Printf("[UPLOAD-DIRECT] Transcode iniciado en background para vod_id=%d", vod.ID)
	}

	// Step 14: Get final VOD
	result, err := s.vodService.GetByID(vod.ID)
	if err != nil {
		log.Printf("[UPLOAD-DIRECT] FAIL step=14-get error obteniendo VOD final: %v", err)
		return nil, fmt.Errorf("error obteniendo VOD: %w", err)
	}

	if browserOK {
		log.Printf("[UPLOAD-DIRECT] === COMPLETADO === vod_id=%d file=%s -> %s (%d bytes) [directo]", result.ID, fileHeader.Filename, streamURL, written)
	} else {
		log.Printf("[UPLOAD-DIRECT] === SUBIDO === vod_id=%d file=%s (%d bytes) [transcodificando a MP4...]", result.ID, fileHeader.Filename, written)
	}

	return result, nil
}

func (s *LocalMediaService) GetByID(id uint) (*dto.LocalMediaResponse, error) {
	media, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	return toLocalMediaResponse(media), nil
}

func (s *LocalMediaService) List(page, perPage int) ([]dto.LocalMediaResponse, int64, error) {
	media, total, err := s.repo.List(page, perPage)
	if err != nil {
		return nil, 0, err
	}

	responses := make([]dto.LocalMediaResponse, len(media))
	for i, m := range media {
		responses[i] = *toLocalMediaResponse(&m)
	}

	return responses, total, nil
}

func (s *LocalMediaService) Delete(id uint) error {
	media, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}

	// Remove uploaded file
	if media.FilePath != "" {
		os.Remove(media.FilePath)
	}

	// Remove HLS directory
	hlsDir := fmt.Sprintf("%s/local/%d", s.mediaPath, media.ID)
	os.RemoveAll(hlsDir)

	// Remove thumbnail
	if media.ThumbnailPath != "" {
		// B5: Safely resolve thumbnail path to prevent path traversal
		thumbRelPath := strings.TrimPrefix(media.ThumbnailPath, "/media/")
		thumbFile := s.SafeResolvePath(s.mediaPath, thumbRelPath)
		if thumbFile != "" {
			os.Remove(thumbFile)
		}
	}

	return s.repo.Delete(id)
}

// UploadDiagnostics devuelve información de diagnóstico del pipeline de subida
type UploadDiagnostics struct {
	CurrentUser     string              `json:"current_user"`
	CurrentUID      string              `json:"current_uid"`
	FFmpegVersion   string              `json:"ffmpeg_version"`
	FFmpegOK        bool                `json:"ffmpeg_ok"`
	FFprobeVersion  string              `json:"ffprobe_version"`
	FFprobeOK       bool                `json:"ffprobe_ok"`
	MediaPath       string              `json:"media_path"`
	Directories     []DirDiag           `json:"directories"`
	DiskFreeGB      float64             `json:"disk_free_gb"`
	DiskTotalGB     float64             `json:"disk_total_gb"`
	RecentMedia     []MediaDiag         `json:"recent_media"`
	PendingCount    int                 `json:"pending_count"`
	ProcessingCount int                 `json:"processing_count"`
	CompletedCount  int                 `json:"completed_count"`
	FailedCount     int                 `json:"failed_count"`
}

type DirDiag struct {
	Path     string `json:"path"`
	Exists   bool   `json:"exists"`
	Writable bool   `json:"writable"`
}

type MediaDiag struct {
	ID               uint      `json:"id"`
	OriginalFilename string    `json:"original_filename"`
	FilePath         string    `json:"file_path"`
	FileExists       bool      `json:"file_exists"`
	FileSizeBytes    int64     `json:"file_size_bytes"`
	HLSPath          string    `json:"hls_path"`
	HLSExists        bool      `json:"hls_exists"`
	Status           string    `json:"status"`
	Progress         int       `json:"progress"`
	ErrorMessage     string    `json:"error_message"`
	Duration         float64   `json:"duration"`
	Resolution       string    `json:"resolution"`
	ThumbnailPath    string    `json:"thumbnail_path"`
	CreatedAt        time.Time `json:"created_at"`
}

func (s *LocalMediaService) Diagnostics() (*UploadDiagnostics, error) {
	diag := &UploadDiagnostics{
		MediaPath: s.mediaPath,
	}

	// Current user
	if u, err := user.Current(); err == nil {
		diag.CurrentUser = u.Username
		diag.CurrentUID = u.Uid
	}

	// FFmpeg check
	if out, err := exec.Command(s.transcoder.ffmpegPath, "-version").Output(); err == nil {
		lines := strings.Split(string(out), "\n")
		if len(lines) > 0 {
			diag.FFmpegVersion = strings.TrimSpace(lines[0])
		}
		diag.FFmpegOK = true
	} else {
		diag.FFmpegVersion = fmt.Sprintf("ERROR: %v", err)
		diag.FFmpegOK = false
	}

	// FFprobe check
	// B19: Use transcoder's ffprobe path
	if out, err := exec.Command(s.transcoder.FFprobePath, "-version").Output(); err == nil {
		lines := strings.Split(string(out), "\n")
		if len(lines) > 0 {
			diag.FFprobeVersion = strings.TrimSpace(lines[0])
		}
		diag.FFprobeOK = true
	} else {
		diag.FFprobeVersion = fmt.Sprintf("ERROR: %v", err)
		diag.FFprobeOK = false
	}

	// Directory checks
	dirs := []string{
		s.mediaPath,
		filepath.Join(s.mediaPath, "uploads"),
		filepath.Join(s.mediaPath, "local"),
		filepath.Join(s.mediaPath, "thumbnails"),
		filepath.Join(s.mediaPath, "vod"),
	}
	for _, dir := range dirs {
		dd := DirDiag{Path: dir}
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			dd.Exists = true
			// Test write permission by creating a temp file
			testFile := filepath.Join(dir, ".tivify_write_test")
			if f, err := os.Create(testFile); err == nil {
				f.Close()
				os.Remove(testFile)
				dd.Writable = true
			}
		}
		diag.Directories = append(diag.Directories, dd)
	}

	// Disk space (Linux/Alpine)
	var stat syscall.Statfs_t
	if err := syscall.Statfs(s.mediaPath, &stat); err == nil {
		diag.DiskFreeGB = float64(stat.Bavail*uint64(stat.Bsize)) / (1024 * 1024 * 1024)
		diag.DiskTotalGB = float64(stat.Blocks*uint64(stat.Bsize)) / (1024 * 1024 * 1024)
	}

	// Recent media entries
	recent, err := s.repo.ListRecent(15)
	if err == nil {
		for _, m := range recent {
			md := MediaDiag{
				ID:               m.ID,
				OriginalFilename: m.OriginalFilename,
				FilePath:         m.FilePath,
				FileSizeBytes:    m.FileSize,
				HLSPath:          m.HLSPath,
				Status:           m.Status,
				Progress:         m.Progress,
				ErrorMessage:     m.ErrorMessage,
				Duration:         m.Duration,
				Resolution:       m.Resolution,
				ThumbnailPath:    m.ThumbnailPath,
				CreatedAt:        m.CreatedAt,
			}
			// Check if source file exists
			if _, err := os.Stat(m.FilePath); err == nil {
				md.FileExists = true
			}
			// Check if HLS output exists
			if m.HLSPath != "" {
				// B5: Safely resolve HLS path to prevent path traversal
				hlsRelPath := strings.TrimPrefix(m.HLSPath, "/media/")
				hlsFile := s.SafeResolvePath(s.mediaPath, hlsRelPath)
				if hlsFile != "" {
					if _, statErr := os.Stat(hlsFile); statErr == nil {
						md.HLSExists = true
					}
				}
			}

			diag.RecentMedia = append(diag.RecentMedia, md)

			switch m.Status {
			case "pending":
				diag.PendingCount++
			case "processing":
				diag.ProcessingCount++
			case "completed":
				diag.CompletedCount++
			case "failed":
				diag.FailedCount++
			}
		}
	}

	return diag, nil
}

func toLocalMediaResponse(m *model.LocalMedia) *dto.LocalMediaResponse {
	return &dto.LocalMediaResponse{
		ID:               m.ID,
		OriginalFilename: m.OriginalFilename,
		FilePath:         m.FilePath,
		HLSPath:          m.HLSPath,
		FileSize:         m.FileSize,
		Duration:         m.Duration,
		Resolution:       m.Resolution,
		MimeType:         m.MimeType,
		Status:           m.Status,
		Progress:         m.Progress,
		ErrorMessage:     m.ErrorMessage,
		ThumbnailPath:    m.ThumbnailPath,
		CreatedAt:        m.CreatedAt,
	}
}

// isValidVideoMimeType checks if a MIME type is a valid video type
func isValidVideoMimeType(mimeType string) bool {
	// Normalize MIME type (remove charset and other parameters)
	if idx := strings.Index(mimeType, ";"); idx >= 0 {
		mimeType = mimeType[:idx]
	}
	mimeType = strings.TrimSpace(mimeType)

	return allowedVideoMimeTypes[mimeType]
}

// B5: SafeResolvePath safely resolves a path and ensures it stays within a base directory
// Returns the resolved path if it's within the base directory, or empty string if it escapes
func (s *LocalMediaService) SafeResolvePath(basePath, relativePath string) string {
	// Clean paths to remove .. and . components
	basePath = filepath.Clean(basePath)
	fullPath := filepath.Clean(filepath.Join(basePath, relativePath))

	// Ensure the resolved path stays within the base directory
	if !strings.HasPrefix(fullPath, basePath) {
		log.Printf("[SECURITY] Path traversal attempt detected: base=%s, relative=%s, resolved=%s", basePath, relativePath, fullPath)
		return ""
	}

	return fullPath
}

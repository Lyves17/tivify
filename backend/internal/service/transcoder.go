package service

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"

	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/ws"
)

type TranscoderService struct {
	mediaRepo  LocalMediaRepositoryInterface
	ffmpegPath string
	// B19: ffprobePath for audio/video codec detection (exported for use in other services)
	FFprobePath string
	mediaPath   string
	semaphore   chan struct{} // Limits concurrent transcoding jobs
	hub         *ws.Hub       // WebSocket hub for real-time progress events (optional)
}

const MaxConcurrentTranscodes = 4 // Limit to 4 concurrent transcoding jobs

// NewTranscoderService creates a new transcoder. hub can be nil (events won't be sent).
func NewTranscoderService(mediaRepo LocalMediaRepositoryInterface, ffmpegPath, ffprobePath, mediaPath string) *TranscoderService {
	if ffprobePath == "" {
		ffprobePath = strings.Replace(ffmpegPath, "ffmpeg", "ffprobe", 1)
		if ffprobePath == ffmpegPath {
			ffprobePath = "ffprobe"
		}
	}
	return &TranscoderService{
		mediaRepo:   mediaRepo,
		ffmpegPath:  ffmpegPath,
		FFprobePath: ffprobePath,
		mediaPath:   mediaPath,
		semaphore:   make(chan struct{}, MaxConcurrentTranscodes),
	}
}

// SetHub sets the WebSocket hub for broadcasting transcode progress events.
func (s *TranscoderService) SetHub(hub *ws.Hub) {
	s.hub = hub
}

// ProbeMedia extracts duration and resolution from a media file using ffprobe.
// Returns zero values and a descriptive error if the receiver is nil so callers
// (and tests) never dereference a nil pointer.
func (s *TranscoderService) ProbeMedia(filePath string) (duration float64, resolution string, err error) {
	if s == nil {
		return 0, "", fmt.Errorf("transcoder service is not configured")
	}
	// Get duration
	// B19: Use configurable ffprobe path
	cmd := exec.Command(s.FFprobePath,
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		filePath,
	)
	out, err := cmd.Output()
	if err != nil {
		return 0, "", fmt.Errorf("ffprobe duration: %w", err)
	}
	duration, _ = strconv.ParseFloat(strings.TrimSpace(string(out)), 64)

	// Get resolution
	// B19: Use configurable ffprobe path
	cmd = exec.Command(s.FFprobePath,
		"-v", "error",
		"-select_streams", "v:0",
		"-show_entries", "stream=height",
		"-of", "default=noprint_wrappers=1:nokey=1",
		filePath,
	)
	out, err = cmd.Output()
	if err != nil {
		return duration, "", fmt.Errorf("ffprobe resolution: %w", err)
	}
	height, _ := strconv.Atoi(strings.TrimSpace(string(out)))
	switch {
	case height >= 2160:
		resolution = "4K"
	case height >= 1080:
		resolution = "1080p"
	case height >= 720:
		resolution = "720p"
	case height >= 480:
		resolution = "480p"
	default:
		resolution = fmt.Sprintf("%dp", height)
	}

	return duration, resolution, nil
}

// GenerateThumbnail creates a thumbnail from the video at 10% of duration
func (s *TranscoderService) GenerateThumbnail(filePath string, outputPath string, duration float64) error {
	if s == nil {
		return fmt.Errorf("transcoder service is not configured")
	}
	seekTo := duration * 0.1
	if seekTo < 1 {
		seekTo = 1
	}

	cmd := exec.Command(s.ffmpegPath,
		"-ss", fmt.Sprintf("%.0f", seekTo),
		"-i", filePath,
		"-vframes", "1",
		"-vf", "scale=320:-1",
		"-y",
		outputPath,
	)
	return cmd.Run()
}

// TranscodeToHLS converts a media file to HLS format in a background goroutine
func (s *TranscoderService) TranscodeToHLS(media *model.LocalMedia) {
	s.TranscodeToHLSWithCallback(media, nil)
}

// TranscodeToHLSWithCallback converts to HLS and calls onComplete when done.
// Uses context.Background(). For cancellation support, use TranscodeToHLSContext.
func (s *TranscoderService) TranscodeToHLSWithCallback(media *model.LocalMedia, onComplete func(hlsPath string, err error)) {
	s.TranscodeToHLSContext(context.Background(), media, onComplete)
}

// TranscodeToHLSContext converts to HLS with cancellation support.
// When ctx is cancelled, the FFmpeg process is killed and status set to "failed".
func (s *TranscoderService) TranscodeToHLSContext(ctx context.Context, media *model.LocalMedia, onComplete func(hlsPath string, err error)) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("ERROR: Panic in TranscodeToHLSContext for media %d: %v", media.ID, r)
				if onComplete != nil {
					onComplete("", fmt.Errorf("transcode panic: %v", r))
				}
			}
		}()

		mediaID := media.ID

		// Acquire semaphore slot, respecting context cancellation
		select {
		case s.semaphore <- struct{}{}:
			log.Printf("[TRANSCODE] Job started for media %d (queue available)", mediaID)
		case <-ctx.Done():
			log.Printf("[TRANSCODE] Job cancelled while queued for media %d", mediaID)
			s.mediaRepo.UpdateStatus(mediaID, "failed", 0, "cancelled")
			if onComplete != nil {
				onComplete("", ctx.Err())
			}
			return
		}

		// Release semaphore slot when done
		defer func() {
			<-s.semaphore
			log.Printf("[TRANSCODE] Job completed for media %d (slot released)", mediaID)
		}()

		log.Printf("[TRANSCODE] Transcoding started for media %d: %s", mediaID, media.OriginalFilename)

		// Update status to processing
		s.mediaRepo.UpdateStatus(mediaID, "processing", 0, "")

		// Create output directory
		outputDir := fmt.Sprintf("%s/local/%d", s.mediaPath, mediaID)
		os.MkdirAll(outputDir, 0755)

		outputPath := fmt.Sprintf("%s/index.m3u8", outputDir)

		// First try codec copy (fastest, works if source is h264+aac)
		err := s.transcodeWithCopy(ctx, media.FilePath, outputPath, mediaID, media.Duration)
		if err != nil && ctx.Err() != nil {
			// Context cancelled, don't retry
			log.Printf("[TRANSCODE] Cancelled for media %d", mediaID)
			s.mediaRepo.UpdateStatus(mediaID, "failed", 0, "cancelled")
			if onComplete != nil {
				onComplete("", ctx.Err())
			}
			return
		}
		if err != nil {
			log.Printf("[TRANSCODE] Codec copy failed for media %d, re-encoding: %v", mediaID, err)
			// Clean up failed attempt
			os.RemoveAll(outputDir)
			os.MkdirAll(outputDir, 0755)

			// Re-encode with h264+aac
			err = s.transcodeWithReencode(ctx, media.FilePath, outputPath, mediaID, media.Duration)
		}

		if err != nil {
			errMsg := err.Error()
			if ctx.Err() != nil {
				errMsg = "cancelled"
			}
			log.Printf("[TRANSCODE] ERROR: Transcoding failed for media %d: %v", mediaID, err)
			s.mediaRepo.UpdateStatus(mediaID, "failed", 0, errMsg)
			if onComplete != nil {
				onComplete("", err)
			}
			return
		}

		// Update media with HLS path
		hlsPath := fmt.Sprintf("/media/local/%d/index.m3u8", mediaID)
		updatedMedia, findErr := s.mediaRepo.FindByID(mediaID)
		if findErr != nil {
			log.Printf("[TRANSCODE] ERROR: Error fetching media %d after transcode: %v", mediaID, findErr)
			return
		}
		updatedMedia.HLSPath = hlsPath
		updatedMedia.Status = "completed"
		updatedMedia.Progress = 100
		if updateErr := s.mediaRepo.Update(updatedMedia); updateErr != nil {
			log.Printf("[TRANSCODE] ERROR: Error updating media %d status to completed: %v", mediaID, updateErr)
		}

		log.Printf("[TRANSCODE] Transcoding completed for media %d", mediaID)

		if onComplete != nil {
			onComplete(hlsPath, nil)
		}
	}()
}

func (s *TranscoderService) transcodeWithCopy(ctx context.Context, input, output string, mediaID uint, duration float64) error {
	cmd := exec.CommandContext(ctx, s.ffmpegPath,
		"-i", input,
		"-codec", "copy",
		"-start_number", "0",
		"-hls_time", "6",
		"-hls_list_size", "0",
		"-f", "hls",
		"-y",
		output,
	)

	return s.runWithProgress(cmd, mediaID, duration)
}

func (s *TranscoderService) transcodeWithReencode(ctx context.Context, input, output string, mediaID uint, duration float64) error {
	cmd := exec.CommandContext(ctx, s.ffmpegPath,
		"-i", input,
		"-c:v", "libx264",
		"-preset", "fast",
		"-crf", "23",
		"-c:a", "aac",
		"-b:a", "128k",
		"-start_number", "0",
		"-hls_time", "6",
		"-hls_list_size", "0",
		"-f", "hls",
		"-y",
		output,
	)

	return s.runWithProgress(cmd, mediaID, duration)
}

var timeRegex = regexp.MustCompile(`time=(\d+):(\d+):(\d+)\.(\d+)`)

// scanCRLF splits on \n, \r\n, or \r (ffmpeg uses \r for progress output)
func scanCRLF(data []byte, atEOF bool) (advance int, token []byte, err error) {
	if atEOF && len(data) == 0 {
		return 0, nil, nil
	}
	for i := 0; i < len(data); i++ {
		if data[i] == '\n' {
			return i + 1, data[:i], nil
		}
		if data[i] == '\r' {
			if i+1 < len(data) && data[i+1] == '\n' {
				return i + 2, data[:i], nil
			}
			return i + 1, data[:i], nil
		}
	}
	if atEOF {
		return len(data), data, nil
	}
	return 0, nil, nil
}

func (s *TranscoderService) runWithProgress(cmd *exec.Cmd, mediaID uint, duration float64) error {
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start: %w", err)
	}

	scanner := bufio.NewScanner(stderr)
	scanner.Split(scanCRLF)

	for scanner.Scan() {
		line := scanner.Text()
		if matches := timeRegex.FindStringSubmatch(line); len(matches) == 5 {
			hours, _ := strconv.Atoi(matches[1])
			minutes, _ := strconv.Atoi(matches[2])
			seconds, _ := strconv.Atoi(matches[3])
			currentSecs := float64(hours*3600 + minutes*60 + seconds)

			if duration > 0 {
				progress := int((currentSecs / duration) * 100)
				if progress > 99 {
					progress = 99
				}
				s.mediaRepo.UpdateStatus(mediaID, "processing", progress, "")
				// Broadcast progress via WebSocket
				if s.hub != nil {
					s.hub.Broadcast(ws.Event{
						Type: "transcode.progress",
						Data: map[string]interface{}{
							"media_id": mediaID,
							"progress": progress,
							"status":   "processing",
						},
					})
				}
			}
		}
	}

	return cmd.Wait()
}

// ProbeCodec returns the video and audio codec names of a file
func (s *TranscoderService) ProbeCodec(filePath string) (videoCodec, audioCodec string, err error) {
	// B19: Use configurable ffprobe path
	cmd := exec.Command(s.FFprobePath,
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

	// B19: Use configurable ffprobe path
	cmd = exec.Command(s.FFprobePath,
		"-v", "error",
		"-select_streams", "a:0",
		"-show_entries", "stream=codec_name",
		"-of", "default=noprint_wrappers=1:nokey=1",
		filePath,
	)
	out, _ = cmd.Output() // audio may not exist
	audioCodec = strings.TrimSpace(string(out))

	return videoCodec, audioCodec, nil
}

// IsBrowserCompatible checks if the file can be played directly in a browser
// or natively on Android (ExoPlayer supports MKV natively).
// MKV files are always served directly without transcoding.
func (s *TranscoderService) IsBrowserCompatible(filePath string) bool {
	ext := strings.ToLower(filePath[strings.LastIndex(filePath, "."):])
	if ext != ".mp4" && ext != ".webm" && ext != ".m4v" && ext != ".mkv" {
		return false
	}
	vCodec, aCodec, err := s.ProbeCodec(filePath)
	if err != nil {
		return false
	}
	// MKV: reproduccion directa — ExoPlayer (Android) soporta cualquier codec,
	// Chrome/Edge soportan MKV con H.264/H.265 + AAC/MP3/Opus
	if ext == ".mkv" {
		return true
	}
	// H.264 video + AAC audio (or no audio) is browser compatible
	if ext == ".mp4" || ext == ".m4v" {
		return (vCodec == "h264" || vCodec == "h265" || vCodec == "hevc") &&
			(aCodec == "aac" || aCodec == "mp3" || aCodec == "")
	}
	// WebM: VP8/VP9 + Vorbis/Opus
	if ext == ".webm" {
		return (vCodec == "vp8" || vCodec == "vp9" || vCodec == "av1") &&
			(aCodec == "vorbis" || aCodec == "opus" || aCodec == "")
	}
	return false
}

// TranscodeToMP4 converts a file to MP4 H.264+AAC (single file, not HLS).
// Runs in background. Calls onComplete(outputPath, err) when done.
// Uses a semaphore to limit concurrent transcoding jobs.
// Uses context.Background() internally; use TranscodeToMP4Context for cancellation.
func (s *TranscoderService) TranscodeToMP4(inputPath, outputPath string, duration float64, onProgress func(pct int), onComplete func(err error)) {
	s.TranscodeToMP4Context(context.Background(), inputPath, outputPath, duration, onProgress, onComplete)
}

// TranscodeToMP4Context is the cancellation-aware variant of TranscodeToMP4.
func (s *TranscoderService) TranscodeToMP4Context(ctx context.Context, inputPath, outputPath string, duration float64, onProgress func(pct int), onComplete func(err error)) {
	// finish wraps onComplete so callers never NPE on a nil callback.
	finish := func(err error) {
		if onComplete != nil {
			onComplete(err)
		}
	}

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("ERROR: Panic in TranscodeToMP4: %v", r)
				finish(fmt.Errorf("transcode panic: %v", r))
			}
		}()

		// Acquire semaphore slot, respecting context cancellation.
		select {
		case s.semaphore <- struct{}{}:
			log.Printf("[TRANSCODE-MP4] Job started: %s -> %s (queue available)", inputPath, outputPath)
		case <-ctx.Done():
			log.Printf("[TRANSCODE-MP4] Job cancelled while queued: %s", inputPath)
			finish(ctx.Err())
			return
		}

		// Release semaphore slot when done
		defer func() {
			<-s.semaphore
			log.Printf("[TRANSCODE-MP4] Job completed, slot released")
		}()

		log.Printf("[TRANSCODE-MP4] Inicio: %s -> %s", inputPath, outputPath)

		cmd := exec.CommandContext(ctx, s.ffmpegPath,
			"-i", inputPath,
			"-c:v", "libx264",
			"-preset", "fast",
			"-crf", "23",
			"-c:a", "aac",
			"-b:a", "128k",
			"-movflags", "+faststart",
			"-y",
			outputPath,
		)

		stderr, err := cmd.StderrPipe()
		if err != nil {
			log.Printf("[TRANSCODE-MP4] Error stderr pipe: %v", err)
			finish(fmt.Errorf("stderr pipe: %w", err))
			return
		}

		if err := cmd.Start(); err != nil {
			log.Printf("[TRANSCODE-MP4] Error start: %v", err)
			finish(fmt.Errorf("start: %w", err))
			return
		}

		scanner := bufio.NewScanner(stderr)
		scanner.Split(scanCRLF)

		for scanner.Scan() {
			line := scanner.Text()
			if matches := timeRegex.FindStringSubmatch(line); len(matches) == 5 {
				hours, _ := strconv.Atoi(matches[1])
				minutes, _ := strconv.Atoi(matches[2])
				seconds, _ := strconv.Atoi(matches[3])
				currentSecs := float64(hours*3600 + minutes*60 + seconds)

				if duration > 0 && onProgress != nil {
					progress := int((currentSecs / duration) * 100)
					if progress > 99 {
						progress = 99
					}
					onProgress(progress)
				}
			}
		}

		if err := cmd.Wait(); err != nil {
			log.Printf("[TRANSCODE-MP4] Error: %v", err)
			finish(fmt.Errorf("transcode failed: %w", err))
			return
		}

		log.Printf("[TRANSCODE-MP4] Completado: %s", outputPath)
		finish(nil)
	}()
}

// ResumePendingTranscodes restarts transcoding for any pending/processing items at startup
func (s *TranscoderService) ResumePendingTranscodes() {
	pending, err := s.mediaRepo.FindPendingTranscodes()
	if err != nil {
		log.Printf("Error finding pending transcodes: %v", err)
		return
	}

	for i := range pending {
		log.Printf("Resuming transcode for media %d", pending[i].ID)
		s.TranscodeToHLS(&pending[i])
	}
}

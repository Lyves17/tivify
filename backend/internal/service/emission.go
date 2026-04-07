package service

import (
	"bytes"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/ws"
	"gorm.io/gorm"
)

const (
	maxAutoRestarts = 3
	restartDelay    = 5 * time.Second
)

type EmissionService struct {
	emissionRepo EmissionRepositoryInterface
	streamRepo   StreamRepositoryInterface
	ffmpegPath   string
	mediaPath    string
	hub          *ws.Hub  // WebSocket hub for real-time emission status events
	processes    sync.Map // channelID (uint) -> *exec.Cmd
	stopping     sync.Map // channelID (uint) -> bool (flag to distinguish intentional stop)
	retries      sync.Map // channelID (uint) -> int (auto-restart counter)
}

// SetHub sets the WebSocket hub for broadcasting emission status events.
func (s *EmissionService) SetHub(hub *ws.Hub) {
	s.hub = hub
}

func (s *EmissionService) broadcastStatus(channelID uint, status string) {
	if s.hub == nil {
		return
	}
	s.hub.Broadcast(ws.Event{
		Type: "emission.status",
		Data: map[string]interface{}{
			"channel_id": channelID,
			"status":     status,
		},
	})
}

func NewEmissionService(
	emissionRepo EmissionRepositoryInterface,
	streamRepo StreamRepositoryInterface,
	ffmpegPath string,
	mediaPath string,
) *EmissionService {
	return &EmissionService{
		emissionRepo: emissionRepo,
		streamRepo:   streamRepo,
		ffmpegPath:   ffmpegPath,
		mediaPath:    mediaPath,
	}
}

func (s *EmissionService) Start(channelID uint) (*dto.EmissionResponse, error) {
	// Resetear contador de reintentos
	s.retries.Delete(channelID)

	// Verificar que no hay emisión activa
	if _, loaded := s.processes.Load(channelID); loaded {
		return nil, errors.New("ya hay una emision activa para este canal")
	}

	// Verificar que existe la playlist generada
	inputPath := filepath.Join(s.mediaPath, "channels", fmt.Sprintf("%d", channelID), "playlist.m3u8")
	if _, err := os.Stat(inputPath); os.IsNotExist(err) {
		return nil, errors.New("primero genera la playlist del canal desde la seccion de Emision Local")
	}

	// Crear directorio de salida y limpiar archivos viejos de una emisión anterior
	outputDir := filepath.Join(s.mediaPath, "live", fmt.Sprintf("%d", channelID))
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("error creando directorio live: %v", err)
	}
	s.cleanupLiveFiles(channelID)

	// Crear/actualizar registro de emisión
	now := time.Now()
	emission, err := s.emissionRepo.FindByChannelID(channelID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			emission = &model.Emission{
				ChannelID: channelID,
				Status:    "starting",
				StartedAt: &now,
			}
			if err := s.emissionRepo.Create(emission); err != nil {
				return nil, fmt.Errorf("error creando registro de emision: %v", err)
			}
		} else {
			return nil, fmt.Errorf("error consultando emision: %v", err)
		}
	} else {
		emission.Status = "starting"
		emission.StartedAt = &now
		emission.Error = ""
		emission.PID = 0
		if err := s.emissionRepo.Save(emission); err != nil {
			return nil, fmt.Errorf("error actualizando emision: %v", err)
		}
	}

	// Lanzar ffmpeg en goroutine
	outputPath := filepath.Join(outputDir, "live.m3u8")
	segmentPattern := filepath.Join(outputDir, "segment_%d.ts")

	go s.runFFmpeg(channelID, inputPath, outputPath, segmentPattern)

	return &dto.EmissionResponse{
		ID:        emission.ID,
		ChannelID: emission.ChannelID,
		Status:    "starting",
		StartedAt: &now,
	}, nil
}

func (s *EmissionService) runFFmpeg(channelID uint, inputPath, outputPath, segmentPattern string) {
	var stderr bytes.Buffer

	cmd := exec.Command(s.ffmpegPath,
		"-re",
		"-stream_loop", "-1",
		"-i", inputPath,
		"-c", "copy",
		"-f", "hls",
		"-hls_time", "6",
		"-hls_list_size", "10",
		"-hls_flags", "delete_segments",
		"-hls_segment_filename", segmentPattern,
		"-y",
		outputPath,
	)
	cmd.Stderr = &stderr

	if err := cmd.Start(); err != nil {
		log.Printf("[Emission] Error iniciando ffmpeg para canal %d: %v", channelID, err)
		s.emissionRepo.UpdateStatus(channelID, "error", 0, fmt.Sprintf("Error iniciando ffmpeg: %v", err))
		return
	}

	pid := cmd.Process.Pid
	s.processes.Store(channelID, cmd)

	log.Printf("[Emission] ffmpeg iniciado para canal %d (PID %d)", channelID, pid)

	// Actualizar estado a running
	s.emissionRepo.UpdateStatus(channelID, "running", pid, "")
	s.broadcastStatus(channelID, "running")

	// Crear/actualizar stream del canal para la emisión live
	s.upsertLiveStream(channelID)

	// Esperar a que termine
	err := cmd.Wait()

	// Limpiar del mapa de procesos
	s.processes.Delete(channelID)

	// Verificar si fue un stop intencional
	if _, wasStopping := s.stopping.LoadAndDelete(channelID); wasStopping {
		log.Printf("[Emission] ffmpeg detenido intencionalmente para canal %d", channelID)
		return // El Stop() ya actualizó el estado
	}

	// Terminación inesperada
	errMsg := ""
	if err != nil {
		errMsg = stderr.String()
		if len(errMsg) > 500 {
			errMsg = errMsg[len(errMsg)-500:]
		}
		log.Printf("[Emission] ffmpeg terminó con error para canal %d: %v", channelID, err)
	} else {
		errMsg = "ffmpeg terminó inesperadamente"
		log.Printf("[Emission] ffmpeg terminó inesperadamente para canal %d (sin error)", channelID)
	}

	// Auto-restart: intentar reiniciar si no se excedió el límite
	retryCount := 0
	if val, ok := s.retries.Load(channelID); ok {
		retryCount = val.(int)
	}

	if retryCount < maxAutoRestarts {
		s.retries.Store(channelID, retryCount+1)
		log.Printf("[Emission] Auto-reiniciando emision canal %d (intento %d/%d)", channelID, retryCount+1, maxAutoRestarts)
		s.emissionRepo.UpdateStatus(channelID, "restarting", 0, fmt.Sprintf("Auto-reinicio %d/%d", retryCount+1, maxAutoRestarts))

		time.Sleep(restartDelay)

		// Verificar que no fue detenido manualmente durante el delay
		if _, wasStopping := s.stopping.Load(channelID); wasStopping {
			s.stopping.Delete(channelID)
			s.retries.Delete(channelID)
			return
		}

		go s.runFFmpeg(channelID, inputPath, outputPath, segmentPattern)
		return // No desactivar stream, el restart lo maneja
	}

	// Máximo de reintentos alcanzado
	log.Printf("[Emission] Maximo de reintentos alcanzado para canal %d", channelID)
	s.retries.Delete(channelID)
	s.emissionRepo.UpdateStatus(channelID, "error", 0, errMsg)
	s.broadcastStatus(channelID, "error")

	// Desactivar stream live
	s.deactivateLiveStream(channelID)
}

func (s *EmissionService) Stop(channelID uint) error {
	// Resetear reintentos y marcar como stop intencional
	s.retries.Delete(channelID)
	s.stopping.Store(channelID, true)

	// Buscar proceso
	val, loaded := s.processes.LoadAndDelete(channelID)
	if !loaded {
		// No hay proceso activo, solo actualizar DB
		s.stopping.Delete(channelID)
		s.emissionRepo.UpdateStatus(channelID, "stopped", 0, "")
		s.deactivateLiveStream(channelID)
		s.cleanupLiveFiles(channelID)
		return nil
	}

	cmd := val.(*exec.Cmd)

	// Enviar SIGTERM
	if cmd.Process != nil {
		log.Printf("[Emission] Enviando SIGTERM a PID %d (canal %d)", cmd.Process.Pid, channelID)
		cmd.Process.Signal(syscall.SIGTERM)

		// Esperar hasta 5 segundos
		done := make(chan error, 1)
		go func() { done <- cmd.Wait() }()

		select {
		case <-done:
			// Terminó limpiamente
		case <-time.After(5 * time.Second):
			// Forzar kill
			log.Printf("[Emission] Forzando kill PID %d (canal %d)", cmd.Process.Pid, channelID)
			cmd.Process.Kill()
			<-done
		}
	}

	// Actualizar estado
	s.emissionRepo.UpdateStatus(channelID, "stopped", 0, "")
	s.broadcastStatus(channelID, "stopped")

	// Desactivar stream live y limpiar archivos
	s.deactivateLiveStream(channelID)
	s.cleanupLiveFiles(channelID)

	log.Printf("[Emission] Emision detenida para canal %d", channelID)
	return nil
}

func (s *EmissionService) GetStatus(channelID uint) (*dto.EmissionStatusResponse, error) {
	emission, err := s.emissionRepo.FindByChannelID(channelID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &dto.EmissionStatusResponse{
				ChannelID: channelID,
				IsLive:    false,
				Status:    "stopped",
			}, nil
		}
		return nil, err
	}

	isLive := emission.Status == "running"

	// Verificar que el proceso realmente está vivo
	if isLive {
		if _, loaded := s.processes.Load(channelID); !loaded {
			// Proceso no existe en memoria, actualizar DB
			s.emissionRepo.UpdateStatus(channelID, "stopped", 0, "")
			isLive = false
			emission.Status = "stopped"
		}
	}

	resp := &dto.EmissionStatusResponse{
		ChannelID: channelID,
		IsLive:    isLive,
		Status:    emission.Status,
		Error:     emission.Error,
	}

	if isLive {
		resp.StreamURL = fmt.Sprintf("/media/live/%d/live.m3u8", channelID)
	}

	return resp, nil
}

func (s *EmissionService) GetLiveChannelIDs() ([]uint, error) {
	emissions, err := s.emissionRepo.FindAllRunning()
	if err != nil {
		return nil, err
	}

	ids := make([]uint, 0, len(emissions))
	for _, e := range emissions {
		// Solo incluir si el proceso realmente está vivo
		if _, loaded := s.processes.Load(e.ChannelID); loaded {
			ids = append(ids, e.ChannelID)
		}
	}

	return ids, nil
}

func (s *EmissionService) CleanupOnStartup() {
	log.Println("[Emission] Limpiando emisiones huerfanas...")

	emissions, err := s.emissionRepo.FindAllRunning()
	if err != nil {
		log.Printf("[Emission] Error consultando emisiones activas: %v", err)
		return
	}

	for _, e := range emissions {
		// Intentar matar el proceso huérfano
		if e.PID > 0 {
			if proc, err := os.FindProcess(e.PID); err == nil {
				log.Printf("[Emission] Matando proceso huerfano PID %d (canal %d)", e.PID, e.ChannelID)
				proc.Signal(syscall.SIGTERM)
				time.Sleep(500 * time.Millisecond)
				proc.Kill()
			}
		}

		// Resetear estado
		s.emissionRepo.UpdateStatus(e.ChannelID, "stopped", 0, "")

		// Desactivar stream live
		s.deactivateLiveStream(e.ChannelID)
	}

	// Limpiar TODOS los directorios live huérfanos (archivos que quedaron
	// de emisiones cortadas por restart/crash incluso si la DB ya tiene status stopped)
	liveDir := filepath.Join(s.mediaPath, "live")
	entries, err := os.ReadDir(liveDir)
	if err == nil {
		for _, entry := range entries {
			if entry.IsDir() {
				dirPath := filepath.Join(liveDir, entry.Name())
				files, _ := os.ReadDir(dirPath)
				if len(files) > 0 {
					log.Printf("[Emission] Limpiando archivos live huerfanos en %s (%d archivos)", entry.Name(), len(files))
					for _, f := range files {
						os.Remove(filepath.Join(dirPath, f.Name()))
					}
				}
			}
		}
	}

	log.Printf("[Emission] Limpieza completada (%d emisiones reseteadas)", len(emissions))
}

func (s *EmissionService) StopAll() {
	log.Println("[Emission] Deteniendo todas las emisiones...")

	s.processes.Range(func(key, value interface{}) bool {
		channelID := key.(uint)
		cmd := value.(*exec.Cmd)

		if cmd.Process != nil {
			log.Printf("[Emission] Deteniendo emision canal %d (PID %d)", channelID, cmd.Process.Pid)
			cmd.Process.Signal(syscall.SIGTERM)

			done := make(chan error, 1)
			go func() { done <- cmd.Wait() }()

			select {
			case <-done:
			case <-time.After(3 * time.Second):
				cmd.Process.Kill()
			}
		}

		s.emissionRepo.UpdateStatus(channelID, "stopped", 0, "")
		s.processes.Delete(channelID)
		return true
	})
}

// upsertLiveStream crea o actualiza el stream live del canal
func (s *EmissionService) upsertLiveStream(channelID uint) {
	liveURL := fmt.Sprintf("/media/live/%d/live.m3u8", channelID)

	// Buscar si ya existe un stream live para este canal
	streams, _ := s.streamRepo.ListByChannel(channelID)
	for _, stream := range streams {
		if stream.URL == liveURL {
			// Ya existe, asegurar que está activo
			stream.IsActive = true
			s.streamRepo.Update(&stream)
			return
		}
	}

	// Crear nuevo stream live
	stream := &model.Stream{
		ChannelID:    channelID,
		URL:          liveURL,
		StreamFormat: "hls",
		Priority:     200, // Mayor prioridad que streams normales
		IsActive:     true,
		Headers:      "{}",
	}
	if err := s.streamRepo.Create(stream); err != nil {
		log.Printf("[Emission] Error creando stream live para canal %d: %v", channelID, err)
	}
}

// deactivateLiveStream desactiva el stream live del canal
func (s *EmissionService) deactivateLiveStream(channelID uint) {
	liveURL := fmt.Sprintf("/media/live/%d/live.m3u8", channelID)

	streams, _ := s.streamRepo.ListByChannel(channelID)
	for _, stream := range streams {
		if stream.URL == liveURL {
			stream.IsActive = false
			s.streamRepo.Update(&stream)
			return
		}
	}
}

// cleanupLiveFiles elimina los archivos temporales de emisión
func (s *EmissionService) cleanupLiveFiles(channelID uint) {
	dir := filepath.Join(s.mediaPath, "live", fmt.Sprintf("%d", channelID))
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		os.Remove(filepath.Join(dir, entry.Name()))
	}
}

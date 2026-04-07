package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/tivify/backend/internal/util"
)

const (
	dockerSocket        = "/var/run/docker.sock"
	tailscaleContainer  = "tivify-tailscale"
	dockerClientTimeout = 10 * time.Second
)

// TailscaleHandler gestiona el contenedor Docker de Tailscale via Docker Engine API.
type TailscaleHandler struct {
	client *http.Client
}

func NewTailscaleHandler() *TailscaleHandler {
	// Cliente HTTP que se conecta al Docker daemon via Unix socket
	client := &http.Client{
		Timeout: dockerClientTimeout,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				return net.DialTimeout("unix", dockerSocket, dockerClientTimeout)
			},
		},
	}
	return &TailscaleHandler{client: client}
}

// containerState representa el estado relevante del contenedor Docker.
type containerState struct {
	Status     string `json:"status"`
	Running    bool   `json:"running"`
	StartedAt  string `json:"started_at,omitempty"`
	FinishedAt string `json:"finished_at,omitempty"`
	Error      string `json:"error,omitempty"`
}

// dockerInspectResponse es un subset de la respuesta de /containers/{id}/json.
type dockerInspectResponse struct {
	State struct {
		Status     string `json:"Status"`
		Running    bool   `json:"Running"`
		StartedAt  string `json:"StartedAt"`
		FinishedAt string `json:"FinishedAt"`
		Error      string `json:"Error"`
	} `json:"State"`
}

// doDockerRequest ejecuta una peticion al Docker Engine API via Unix socket.
func (h *TailscaleHandler) doDockerRequest(method, path string) (*http.Response, error) {
	// Docker Engine API se accede como http://localhost pero via socket Unix
	url := fmt.Sprintf("http://localhost%s", path)
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		return nil, fmt.Errorf("error creando request: %w", err)
	}
	return h.client.Do(req)
}

// Status devuelve el estado actual del contenedor Tailscale.
// GET /api/v1/admin/tailscale/status
func (h *TailscaleHandler) Status(c *fiber.Ctx) error {
	resp, err := h.doDockerRequest("GET", fmt.Sprintf("/containers/%s/json", tailscaleContainer))
	if err != nil {
		log.Printf("ERROR [TAILSCALE] Failed to inspect container: %v", err)
		return util.Error(c, fiber.StatusServiceUnavailable, "No se pudo conectar al Docker daemon")
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return util.Success(c, fiber.Map{
			"container": tailscaleContainer,
			"status":    "not_found",
			"running":   false,
			"message":   "El contenedor Tailscale no existe. Ejecuta docker compose up tailscale primero.",
		})
	}

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return util.Error(c, fiber.StatusInternalServerError, fmt.Sprintf("Docker API error: %s", string(body)))
	}

	var inspect dockerInspectResponse
	if err := json.NewDecoder(resp.Body).Decode(&inspect); err != nil {
		return util.Error(c, fiber.StatusInternalServerError, "Error parseando respuesta de Docker")
	}

	return util.Success(c, fiber.Map{
		"container":   tailscaleContainer,
		"status":      inspect.State.Status,
		"running":     inspect.State.Running,
		"started_at":  inspect.State.StartedAt,
		"finished_at": inspect.State.FinishedAt,
		"error":       inspect.State.Error,
	})
}

// Start arranca el contenedor Tailscale.
// POST /api/v1/admin/tailscale/start
func (h *TailscaleHandler) Start(c *fiber.Ctx) error {
	log.Println("INFO [TAILSCALE] Starting container...")

	resp, err := h.doDockerRequest("POST", fmt.Sprintf("/containers/%s/start", tailscaleContainer))
	if err != nil {
		log.Printf("ERROR [TAILSCALE] Failed to start container: %v", err)
		return util.Error(c, fiber.StatusServiceUnavailable, "No se pudo conectar al Docker daemon")
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case 204:
		log.Println("INFO [TAILSCALE] Container started successfully")
		return util.Success(c, fiber.Map{
			"container": tailscaleContainer,
			"action":    "started",
			"message":   "Contenedor Tailscale arrancado correctamente",
		})
	case 304:
		return util.Success(c, fiber.Map{
			"container": tailscaleContainer,
			"action":    "already_running",
			"message":   "El contenedor Tailscale ya estaba en ejecucion",
		})
	case 404:
		return util.Error(c, fiber.StatusNotFound, "El contenedor Tailscale no existe. Ejecuta docker compose up tailscale primero.")
	default:
		body, _ := io.ReadAll(resp.Body)
		log.Printf("ERROR [TAILSCALE] Unexpected Docker API response %d: %s", resp.StatusCode, string(body))
		return util.Error(c, fiber.StatusInternalServerError, fmt.Sprintf("Error inesperado al arrancar Tailscale: %s", string(body)))
	}
}

// Stop detiene el contenedor Tailscale.
// POST /api/v1/admin/tailscale/stop
func (h *TailscaleHandler) Stop(c *fiber.Ctx) error {
	log.Println("INFO [TAILSCALE] Stopping container...")

	resp, err := h.doDockerRequest("POST", fmt.Sprintf("/containers/%s/stop", tailscaleContainer))
	if err != nil {
		log.Printf("ERROR [TAILSCALE] Failed to stop container: %v", err)
		return util.Error(c, fiber.StatusServiceUnavailable, "No se pudo conectar al Docker daemon")
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case 204:
		log.Println("INFO [TAILSCALE] Container stopped successfully")
		return util.Success(c, fiber.Map{
			"container": tailscaleContainer,
			"action":    "stopped",
			"message":   "Contenedor Tailscale detenido correctamente",
		})
	case 304:
		return util.Success(c, fiber.Map{
			"container": tailscaleContainer,
			"action":    "already_stopped",
			"message":   "El contenedor Tailscale ya estaba detenido",
		})
	case 404:
		return util.Error(c, fiber.StatusNotFound, "El contenedor Tailscale no existe")
	default:
		body, _ := io.ReadAll(resp.Body)
		log.Printf("ERROR [TAILSCALE] Unexpected Docker API response %d: %s", resp.StatusCode, string(body))
		return util.Error(c, fiber.StatusInternalServerError, fmt.Sprintf("Error inesperado al detener Tailscale: %s", string(body)))
	}
}

// Restart reinicia el contenedor Tailscale.
// POST /api/v1/admin/tailscale/restart
func (h *TailscaleHandler) Restart(c *fiber.Ctx) error {
	log.Println("INFO [TAILSCALE] Restarting container...")

	resp, err := h.doDockerRequest("POST", fmt.Sprintf("/containers/%s/restart", tailscaleContainer))
	if err != nil {
		log.Printf("ERROR [TAILSCALE] Failed to restart container: %v", err)
		return util.Error(c, fiber.StatusServiceUnavailable, "No se pudo conectar al Docker daemon")
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case 204:
		log.Println("INFO [TAILSCALE] Container restarted successfully")
		return util.Success(c, fiber.Map{
			"container": tailscaleContainer,
			"action":    "restarted",
			"message":   "Contenedor Tailscale reiniciado correctamente",
		})
	case 404:
		return util.Error(c, fiber.StatusNotFound, "El contenedor Tailscale no existe")
	default:
		body, _ := io.ReadAll(resp.Body)
		log.Printf("ERROR [TAILSCALE] Unexpected Docker API response %d: %s", resp.StatusCode, string(body))
		return util.Error(c, fiber.StatusInternalServerError, fmt.Sprintf("Error inesperado al reiniciar Tailscale: %s", string(body)))
	}
}

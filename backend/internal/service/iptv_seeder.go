package service

import (
	"bufio"
	"compress/gzip"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/util"
)

// ─── M3U ────────────────────────────────────────────────────────────────────

type m3uEntry struct {
	TvgID       string
	TvgName     string
	TvgLogo     string
	TvgCountry  string
	TvgLanguage string
	GroupTitle  string
	URL         string
}

// ─── XMLTV ──────────────────────────────────────────────────────────────────

type xmltvTV struct {
	XMLName    xml.Name         `xml:"tv"`
	Programmes []xmltvProgramme `xml:"programme"`
}

type xmltvProgramme struct {
	Start      string          `xml:"start,attr"`
	Stop       string          `xml:"stop,attr"`
	Channel    string          `xml:"channel,attr"`
	Title      []xmltvLangText `xml:"title"`
	Desc       []xmltvLangText `xml:"desc"`
	Category   []xmltvLangText `xml:"category"`
	EpisodeNum string          `xml:"episode-num"`
}

type xmltvLangText struct {
	Lang  string `xml:"lang,attr"`
	Value string `xml:",chardata"`
}

// ─── Import Options + Status ─────────────────────────────────────────────────

// IPTVImportOptions permite filtrar y configurar una importación IPTV.
type IPTVImportOptions struct {
	// M3UURL es la URL del archivo M3U a importar.
	// Por defecto: https://iptv-org.github.io/iptv/index.m3u
	M3UURL string

	// EPGURL sobreescribe la URL de EPG extraída del M3U (opcional).
	EPGURL string

	// Countries filtra por tvg-country (e.g. ["ES","MX"]). Vacío = todos.
	Countries []string

	// Languages filtra por tvg-language (e.g. ["Spanish","English"]). Vacío = todos.
	Languages []string

	// Categories filtra por group-title (e.g. ["News","Sports"]). Vacío = todos.
	Categories []string

	// Replace elimina los canales IPTV de la misma fuente antes de importar.
	// Los canales manuales (source="") NUNCA se tocan.
	Replace bool

	// Source es el identificador de fuente para los canales importados.
	// Por defecto: "iptv-org"
	Source string
}

// IPTVImportStatus refleja el progreso de una importación en curso.
type IPTVImportStatus struct {
	Running  bool   `json:"running"`
	Total    int    `json:"total"`
	Current  int    `json:"current"`
	Percent  int    `json:"percent"`
	Message  string `json:"message"`
	Error    string `json:"error,omitempty"`
	Imported int    `json:"imported"`
}

// ─── IPTVSeeder ─────────────────────────────────────────────────────────────

type IPTVSeeder struct {
	channelRepo  ChannelRepositoryInterface
	streamRepo   StreamRepositoryInterface
	categoryRepo CategoryRepositoryInterface
	epgRepo      EPGRepositoryInterface
	httpClient   *http.Client

	mu     sync.RWMutex
	status IPTVImportStatus
}

func NewIPTVSeeder(
	channelRepo ChannelRepositoryInterface,
	streamRepo StreamRepositoryInterface,
	categoryRepo CategoryRepositoryInterface,
	epgRepo EPGRepositoryInterface,
) *IPTVSeeder {
	return &IPTVSeeder{
		channelRepo:  channelRepo,
		streamRepo:   streamRepo,
		categoryRepo: categoryRepo,
		epgRepo:      epgRepo,
		httpClient: &http.Client{
			Timeout: 10 * time.Minute,
		},
	}
}

// GetStatus devuelve el estado actual de importación (seguro para goroutines).
func (s *IPTVSeeder) GetStatus() IPTVImportStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.status
}

func (s *IPTVSeeder) setStatus(st IPTVImportStatus) {
	s.mu.Lock()
	s.status = st
	s.mu.Unlock()
}

// IsRunning devuelve true si hay una importación en curso.
func (s *IPTVSeeder) IsRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.status.Running
}

// ─── Startup seed ────────────────────────────────────────────────────────────

// SeedFromURL importa canales en el primer arranque si la BD está completamente vacía.
// Preserva cualquier canal existente (manual o no).
// Diseñado para ejecutarse en una goroutine.
func (s *IPTVSeeder) SeedFromURL(m3uURL string) {
	count, err := s.channelRepo.Count()
	if err != nil {
		log.Printf("[IPTV] Error verificando canales: %v", err)
		return
	}
	if count > 0 {
		log.Printf("[IPTV] Ya existen %d canales, saltando importacion inicial", count)
		return
	}

	opts := IPTVImportOptions{
		M3UURL:  m3uURL,
		Replace: false, // no hay nada que reemplazar
		Source:  "iptv-org",
	}
	s.ImportWithOptions(opts)
}

// ─── Admin-triggered import ──────────────────────────────────────────────────

// ImportWithOptions realiza una importación completa con las opciones dadas.
// Puede llamarse desde el panel de admin para reimportar con filtros.
// Los canales manuales (source="") nunca se tocan.
// B8: For new code, use ImportWithOptionsContext for cancellation support
func (s *IPTVSeeder) ImportWithOptions(opts IPTVImportOptions) {
	s.ImportWithOptionsContext(context.Background(), opts)
}

// ImportWithOptionsContext realiza una importación completa con soporte para contexto y cancelación.
// B8: Accepts context.Context parameter for cancellation and timeouts
func (s *IPTVSeeder) ImportWithOptionsContext(ctx context.Context, opts IPTVImportOptions) {
	// B11: Atomic check-and-set using mutex to prevent race conditions
	s.mu.Lock()
	if s.status.Running {
		s.mu.Unlock()
		log.Printf("[IPTV] Ya hay una importacion en curso, ignorando")
		return
	}
	// Mark as running while still holding the lock
	s.status.Running = true
	s.status.Message = "Iniciando importacion..."
	s.mu.Unlock()

	if opts.Source == "" {
		opts.Source = "iptv-org"
	}
	if opts.M3UURL == "" {
		opts.M3UURL = "https://iptv-org.github.io/iptv/index.m3u"
	}

	s.setStatus(IPTVImportStatus{Running: true, Message: "Descargando M3U..."})
	log.Printf("[IPTV] Iniciando importacion: url=%s source=%s replace=%v countries=%v languages=%v categories=%v",
		opts.M3UURL, opts.Source, opts.Replace, opts.Countries, opts.Languages, opts.Categories)

	body, epgURL, err := s.fetchM3U(opts.M3UURL)
	if err != nil {
		s.setStatus(IPTVImportStatus{Running: false, Error: fmt.Sprintf("Error descargando M3U: %v", err)})
		log.Printf("[IPTV] Error descargando M3U: %v", err)
		return
	}

	// Si hay una URL de EPG manual, tiene prioridad
	if opts.EPGURL != "" {
		epgURL = opts.EPGURL
	}

	s.setStatus(IPTVImportStatus{Running: true, Message: "Parseando canales..."})
	allEntries := s.parseM3U(body)
	log.Printf("[IPTV] %d canales en el M3U antes de filtros", len(allEntries))

	// Aplicar filtros
	entries := s.applyFilters(allEntries, opts)
	log.Printf("[IPTV] %d canales tras aplicar filtros", len(entries))

	if len(entries) == 0 {
		s.setStatus(IPTVImportStatus{Running: false, Message: "Sin canales tras aplicar filtros"})
		return
	}

	// Si Replace=true → borrar canales IPTV existentes de la misma fuente
	if opts.Replace {
		s.setStatus(IPTVImportStatus{Running: true, Message: fmt.Sprintf("Eliminando canales de fuente '%s'...", opts.Source)})
		if err := s.channelRepo.DeleteBySource(opts.Source); err != nil {
			log.Printf("[IPTV] Error eliminando canales de fuente '%s': %v", opts.Source, err)
		}
	}

	// Crear categorías
	s.setStatus(IPTVImportStatus{Running: true, Total: len(entries), Message: "Creando categorías..."})
	categoryMap := s.buildCategories(entries)

	// B8: Check if context was cancelled before proceeding
	select {
	case <-ctx.Done():
		s.setStatus(IPTVImportStatus{Running: false, Error: "Importacion cancelada"})
		log.Printf("[IPTV] Importacion cancelada por el usuario")
		return
	default:
	}

	// Importar canales + streams
	epgIDtoChannelID := s.importChannelsWithOptionsContext(ctx, entries, categoryMap, opts)
	log.Printf("[IPTV] %d canales importados correctamente", len(epgIDtoChannelID))

	// Importar EPG
	if epgURL != "" {
		s.setStatus(IPTVImportStatus{
			Running: true, Total: len(entries), Current: len(entries),
			Percent: 100, Message: "Importando EPG...", Imported: len(epgIDtoChannelID),
		})
		log.Printf("[IPTV] Importando EPG desde %s", epgURL)
		s.importEPG(epgURL, epgIDtoChannelID)
	} else {
		log.Printf("[IPTV] Sin URL de EPG disponible")
	}

	s.setStatus(IPTVImportStatus{
		Running: false, Total: len(entries), Current: len(entries),
		Percent: 100, Imported: len(epgIDtoChannelID),
		Message: fmt.Sprintf("Importacion completada: %d canales", len(epgIDtoChannelID)),
	})
	log.Printf("[IPTV] Importacion completada: %d canales de fuente '%s'", len(epgIDtoChannelID), opts.Source)
}

// ─── Filters ─────────────────────────────────────────────────────────────────

func (s *IPTVSeeder) applyFilters(entries []m3uEntry, opts IPTVImportOptions) []m3uEntry {
	if len(opts.Countries) == 0 && len(opts.Languages) == 0 && len(opts.Categories) == 0 {
		return entries // sin filtros → todos
	}

	// Normalizar filtros a lowercase para comparación insensible a mayúsculas
	cntSet := toLowerSet(opts.Countries)
	langSet := toLowerSet(opts.Languages)
	catSet := toLowerSet(opts.Categories)

	var filtered []m3uEntry
	for _, e := range entries {
		if len(cntSet) > 0 {
			if !cntSet[strings.ToLower(e.TvgCountry)] {
				continue
			}
		}
		if len(langSet) > 0 {
			if !langSet[strings.ToLower(e.TvgLanguage)] {
				continue
			}
		}
		if len(catSet) > 0 {
			if !catSet[strings.ToLower(e.GroupTitle)] {
				continue
			}
		}
		filtered = append(filtered, e)
	}
	return filtered
}

func toLowerSet(items []string) map[string]bool {
	m := make(map[string]bool, len(items))
	for _, v := range items {
		m[strings.ToLower(strings.TrimSpace(v))] = true
	}
	return m
}

// ─── M3U fetch + parse ───────────────────────────────────────────────────────

var (
	reURLTvg = regexp.MustCompile(`(?i)url-tvg="([^"]+)"`)
	reAttr   = regexp.MustCompile(`([\w-]+)="([^"]*)"`)
)

func (s *IPTVSeeder) fetchM3U(url string) (content string, epgURL string, err error) {
	resp, err := s.httpClient.Get(url)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", "", fmt.Errorf("HTTP %d al descargar M3U desde %s", resp.StatusCode, url)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, 100*1024*1024))
	if err != nil {
		return "", "", err
	}

	content = string(data)
	epgURL = extractM3UHeader(content, reURLTvg)
	return content, epgURL, nil
}

func extractM3UHeader(content string, re *regexp.Regexp) string {
	scanner := bufio.NewScanner(strings.NewReader(content))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "#EXTM3U") {
			if m := re.FindStringSubmatch(line); len(m) >= 2 {
				return strings.TrimSpace(m[1])
			}
			return ""
		}
	}
	return ""
}

func (s *IPTVSeeder) parseM3U(content string) []m3uEntry {
	var entries []m3uEntry
	var current m3uEntry
	inEntry := false

	scanner := bufio.NewScanner(strings.NewReader(content))
	buf := make([]byte, 2*1024*1024)
	scanner.Buffer(buf, cap(buf))

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#EXTM3U") {
			continue
		}

		if strings.HasPrefix(line, "#EXTINF:") {
			current = m3uEntry{}
			inEntry = true

			for _, m := range reAttr.FindAllStringSubmatch(line, -1) {
				switch strings.ToLower(m[1]) {
				case "tvg-id":
					current.TvgID = m[2]
				case "tvg-name":
					current.TvgName = m[2]
				case "tvg-logo":
					current.TvgLogo = m[2]
				case "tvg-country":
					current.TvgCountry = m[2]
				case "tvg-language":
					current.TvgLanguage = m[2]
				case "group-title":
					current.GroupTitle = m[2]
				}
			}

			if idx := strings.LastIndex(line, ","); idx >= 0 {
				displayName := strings.TrimSpace(line[idx+1:])
				if current.TvgName == "" && displayName != "" {
					current.TvgName = displayName
				}
			}

		} else if inEntry && !strings.HasPrefix(line, "#") {
			current.URL = line
			if current.TvgName != "" && current.URL != "" {
				entries = append(entries, current)
			}
			inEntry = false
		}
	}

	return entries
}

// ─── Categories ──────────────────────────────────────────────────────────────

func (s *IPTVSeeder) buildCategories(entries []m3uEntry) map[string]*model.Category {
	catMap := make(map[string]*model.Category)
	seen := make(map[string]bool)

	for _, e := range entries {
		group := e.GroupTitle
		if group == "" {
			group = "Sin Categoría"
		}
		seen[group] = true
	}

	for group := range seen {
		slug := generateSlug(group)
		if slug == "" {
			slug = "sin-categoria"
		}

		existing, err := s.categoryRepo.FindBySlug(slug)
		if err == nil {
			catMap[group] = existing
			continue
		}

		cat := &model.Category{
			Name: group,
			Slug: slug,
			Type: "live",
		}
		if createErr := s.categoryRepo.Create(cat); createErr != nil {
			cat.Slug = slug + "-live"
			if createErr2 := s.categoryRepo.Create(cat); createErr2 != nil {
				log.Printf("[IPTV] Error creando categoria '%s': %v", group, createErr2)
				continue
			}
		}
		catMap[group] = cat
	}

	return catMap
}

// ─── Channels + Streams ──────────────────────────────────────────────────────

// B8: New method with context support for cancellation
func (s *IPTVSeeder) importChannelsWithOptionsContext(ctx context.Context, entries []m3uEntry, catMap map[string]*model.Category, opts IPTVImportOptions) map[string]uint {
	epgToID := make(map[string]uint)
	slugCount := make(map[string]int)
	total := len(entries)
	imported := 0

	for i, e := range entries {
		// B20: Check context cancellation every iteration
		if ctx.Err() != nil {
			log.Printf("[IPTV] Import cancelled after %d/%d channels", imported, total)
			return epgToID
		}

		group := e.GroupTitle
		if group == "" {
			group = "Sin Categoría"
		}

		var catID *uint
		if cat, ok := catMap[group]; ok && cat != nil && cat.ID > 0 {
			catID = &cat.ID
		}

		baseName := e.TvgName
		if baseName == "" {
			baseName = fmt.Sprintf("canal-%d", i+1)
		}
		baseSlug := generateSlug(baseName)
		if baseSlug == "" {
			baseSlug = fmt.Sprintf("canal-%d", i+1)
		}
		slugCount[baseSlug]++
		slug := baseSlug
		if slugCount[baseSlug] > 1 {
			slug = fmt.Sprintf("%s-%d", baseSlug, slugCount[baseSlug])
		}

		channel := &model.Channel{
			Name:         e.TvgName,
			Slug:         slug,
			CategoryID:   catID,
			LogoURL:      e.TvgLogo,
			EPGChannelID: e.TvgID,
			IsActive:     true,
			Source:       opts.Source,
		}
		if err := s.channelRepo.Create(channel); err != nil {
			log.Printf("[IPTV] Error creando canal '%s': %v", e.TvgName, err)
			continue
		}

		// B4: Validate stream URL against SSRF attacks before storing
		if err := util.ValidateStreamURL(e.URL); err != nil {
			log.Printf("[IPTV] Skipping invalid stream URL for '%s': %v", e.TvgName, err)
			continue
		}

		stream := &model.Stream{
			ChannelID:    channel.ID,
			URL:          e.URL,
			StreamFormat: guessStreamFormat(e.URL),
			Priority:     1,
			IsActive:     true,
			Headers:      "{}",
		}
		if err := s.streamRepo.Create(stream); err != nil {
			log.Printf("[IPTV] Error creando stream para '%s': %v", e.TvgName, err)
		}

		if e.TvgID != "" {
			epgToID[e.TvgID] = channel.ID
		}
		imported++

		// Actualizar progreso cada 100 canales
		if (i+1)%100 == 0 || i+1 == total {
			pct := ((i + 1) * 100) / total
			s.setStatus(IPTVImportStatus{
				Running: true, Total: total, Current: i + 1,
				Percent: pct, Imported: imported,
				Message: fmt.Sprintf("Importando canales: %d/%d", i+1, total),
			})
			if (i+1)%500 == 0 {
				log.Printf("[IPTV] Progreso: %d/%d canales importados...", i+1, total)
			}
		}
	}

	return epgToID
}

func guessStreamFormat(url string) string {
	lower := strings.ToLower(url)
	switch {
	case strings.HasPrefix(lower, "rtmp://") || strings.HasPrefix(lower, "rtmps://"):
		return "rtmp"
	case strings.Contains(lower, ".ts") || strings.Contains(lower, "mpegts"):
		return "mpegts"
	default:
		return "hls"
	}
}

// ─── EPG (XMLTV) ─────────────────────────────────────────────────────────────

func (s *IPTVSeeder) importEPG(epgURL string, channelIDMap map[string]uint) {
	resp, err := s.httpClient.Get(epgURL)
	if err != nil {
		log.Printf("[IPTV] Error descargando EPG: %v", err)
		return
	}
	defer resp.Body.Close()

	var reader io.Reader = resp.Body
	contentEncoding := resp.Header.Get("Content-Encoding")
	if strings.HasSuffix(strings.ToLower(epgURL), ".gz") || contentEncoding == "gzip" {
		gz, err := gzip.NewReader(resp.Body)
		if err != nil {
			log.Printf("[IPTV] Error abriendo gzip EPG: %v", err)
			return
		}
		defer gz.Close()
		reader = gz
	}

	data, err := io.ReadAll(io.LimitReader(reader, 300*1024*1024))
	if err != nil {
		log.Printf("[IPTV] Error leyendo EPG: %v", err)
		return
	}

	entries, err := s.parseXMLTV(data, channelIDMap)
	if err != nil {
		log.Printf("[IPTV] Error parseando XMLTV: %v", err)
		return
	}

	log.Printf("[IPTV] Importando %d entradas EPG...", len(entries))
	const batchSize = 200
	for i := 0; i < len(entries); i += batchSize {
		end := i + batchSize
		if end > len(entries) {
			end = len(entries)
		}
		for j := range entries[i:end] {
			entry := entries[i+j]
			_ = s.epgRepo.Create(&entry)
		}
	}
	log.Printf("[IPTV] EPG importado: %d entradas", len(entries))
}

func (s *IPTVSeeder) parseXMLTV(data []byte, channelIDMap map[string]uint) ([]model.EPGEntry, error) {
	var tv xmltvTV
	if err := xml.Unmarshal(data, &tv); err != nil {
		return nil, fmt.Errorf("xml.Unmarshal: %w", err)
	}

	now := time.Now().UTC()
	horizon := now.Add(48 * time.Hour)

	var entries []model.EPGEntry
	for _, prog := range tv.Programmes {
		channelID, ok := channelIDMap[prog.Channel]
		if !ok {
			continue
		}

		startTime, err := parseXMLTVTime(prog.Start)
		if err != nil {
			continue
		}
		endTime, err := parseXMLTVTime(prog.Stop)
		if err != nil {
			continue
		}

		if startTime.Before(now.Add(-1*time.Hour)) || startTime.After(horizon) {
			continue
		}

		title := firstText(prog.Title)
		if title == "" {
			continue
		}

		entries = append(entries, model.EPGEntry{
			ChannelID:   channelID,
			Title:       title,
			Description: firstText(prog.Desc),
			StartTime:   startTime,
			EndTime:     endTime,
			Category:    firstText(prog.Category),
			Language:    firstLang(prog.Title),
			EpisodeNum:  prog.EpisodeNum,
		})
	}

	return entries, nil
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// B17: parseXMLTVTime handles multiple XMLTV time formats including various timezone representations
func parseXMLTVTime(s string) (time.Time, error) {
	s = strings.TrimSpace(s)

	// Try formats with timezone information first
	timeFormats := []string{
		// Format: YYYYMMDDhhmmss +/-hhmm
		"20060102150405 -0700",
		"20060102150405 -07:00",
		// Format: YYYYMMDDhhmmss [+-]hh:mm  (with colon)
		"20060102150405 -0700",
		// Format: YYYYMMDDhhmmssZ (UTC)
		"20060102150405Z",
		// Bare format without timezone (assume UTC)
		"20060102150405",
	}

	// Try each format
	for _, format := range timeFormats {
		if strings.Contains(format, " ") {
			// Format requires timezone info
			if len(s) >= 19 {
				if t, err := time.Parse(format, s); err == nil {
					return t.UTC(), nil
				}
			}
		} else if strings.Contains(format, "Z") {
			// Format ends with Z
			if strings.HasSuffix(s, "Z") && len(s) >= 15 {
				if t, err := time.Parse(format, s); err == nil {
					return t.UTC(), nil
				}
			}
		} else {
			// Bare format - try full string first, then first 14 chars
			if len(s) >= 14 {
				if t, err := time.Parse(format, s[:14]); err == nil {
					return t.UTC(), nil
				}
			}
		}
	}

	return time.Time{}, fmt.Errorf("no se puede parsear tiempo XMLTV: %q", s)
}

func firstText(items []xmltvLangText) string {
	if len(items) == 0 {
		return ""
	}
	return strings.TrimSpace(items[0].Value)
}

func firstLang(items []xmltvLangText) string {
	if len(items) == 0 {
		return ""
	}
	return items[0].Lang
}

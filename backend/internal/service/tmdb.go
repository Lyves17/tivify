package service

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type TMDBService struct {
	apiKey     string // v3 API key (short, used as query param)
	readToken  string // v4 Read Access Token (long, used as Bearer)
	baseURL    string
	imgBase    string
	client     *http.Client
	authMethod string // "bearer" or "apikey"
}

type TMDBSearchResult struct {
	ID           int     `json:"id"`
	Title        string  `json:"title"`
	Name         string  `json:"name"`
	Overview     string  `json:"overview"`
	PosterPath   string  `json:"poster_path"`
	BackdropPath string  `json:"backdrop_path"`
	ReleaseDate  string  `json:"release_date"`
	FirstAirDate string  `json:"first_air_date"`
	VoteAverage  float64 `json:"vote_average"`
	MediaType    string  `json:"media_type"` // for /search/multi
}

type tmdbSearchResponse struct {
	Page         int                `json:"page"`
	Results      []TMDBSearchResult `json:"results"`
	TotalResults int                `json:"total_results"`
	TotalPages   int                `json:"total_pages"`
}

type tmdbErrorResponse struct {
	StatusMessage string `json:"status_message"`
	StatusCode    int    `json:"status_code"`
	Success       bool   `json:"success"`
}

func NewTMDBService(apiKey string) *TMDBService {
	svc := &TMDBService{
		baseURL: "https://api.themoviedb.org/3",
		imgBase: "https://image.tmdb.org/t/p/",
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}

	if apiKey == "" {
		log.Println("WARNING [TMDB] API key not configured - TMDB features disabled")
		return svc
	}

	// Detect auth method based on key format:
	// - v4 Read Access Token: starts with "eyJ" (JWT-like, ~200+ chars)
	// - v3 API Key: short alphanumeric string (~32 chars)
	if strings.HasPrefix(apiKey, "eyJ") && len(apiKey) > 100 {
		svc.readToken = apiKey
		svc.authMethod = "bearer"
		log.Println("INFO [TMDB] Using Bearer token authentication (v4 Read Access Token)")
	} else {
		svc.apiKey = apiKey
		svc.authMethod = "apikey"
		log.Println("INFO [TMDB] Using API key authentication (v3)")
	}

	return svc
}

func (s *TMDBService) IsConfigured() bool {
	return s.apiKey != "" || s.readToken != ""
}

// doRequest creates and executes an authenticated TMDB API request
func (s *TMDBService) doRequest(endpoint string, params url.Values) (*http.Response, error) {
	// Always include language for Spanish results
	if params.Get("language") == "" {
		params.Set("language", "es-ES")
	}
	// Include adult content filtering
	params.Set("include_adult", "false")

	reqURL := fmt.Sprintf("%s%s?%s", s.baseURL, endpoint, params.Encode())

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("TMDB create request error: %w", err)
	}

	req.Header.Set("Accept", "application/json")

	// Set authentication based on method
	switch s.authMethod {
	case "bearer":
		req.Header.Set("Authorization", "Bearer "+s.readToken)
	case "apikey":
		// api_key is already in the query params, but add it if missing
		q := req.URL.Query()
		if q.Get("api_key") == "" {
			q.Set("api_key", s.apiKey)
			req.URL.RawQuery = q.Encode()
		}
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("TMDB request error: %w", err)
	}

	return resp, nil
}

// parseResponse handles TMDB response parsing with error handling
func (s *TMDBService) parseSearchResponse(resp *http.Response) (*tmdbSearchResponse, error) {
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("TMDB read body error: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var tmdbErr tmdbErrorResponse
		json.Unmarshal(body, &tmdbErr)
		if tmdbErr.StatusMessage != "" {
			log.Printf("ERROR [TMDB] API error (HTTP %d): %s (code: %d)", resp.StatusCode, tmdbErr.StatusMessage, tmdbErr.StatusCode)
			return nil, fmt.Errorf("TMDB API error: %s", tmdbErr.StatusMessage)
		}
		return nil, fmt.Errorf("TMDB HTTP status %d: %s", resp.StatusCode, string(body))
	}

	var result tmdbSearchResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("TMDB decode error: %w", err)
	}

	return &result, nil
}

func (s *TMDBService) SearchMovie(title string, year int) (*TMDBSearchResult, error) {
	if !s.IsConfigured() {
		return nil, fmt.Errorf("TMDB API key no configurada")
	}

	params := url.Values{}
	if s.authMethod == "apikey" {
		params.Set("api_key", s.apiKey)
	}
	params.Set("query", title)
	if year > 0 {
		params.Set("year", fmt.Sprintf("%d", year))
	}

	resp, err := s.doRequest("/search/movie", params)
	if err != nil {
		return nil, err
	}

	result, err := s.parseSearchResponse(resp)
	if err != nil {
		// If year search fails, retry without year
		if year > 0 {
			log.Printf("INFO [TMDB] Movie search with year=%d failed for '%s', retrying without year", year, title)
			return s.SearchMovie(title, 0)
		}
		return nil, err
	}

	time.Sleep(250 * time.Millisecond) // rate limit

	if len(result.Results) == 0 {
		// Fallback: try without year if we had one
		if year > 0 {
			log.Printf("INFO [TMDB] No movie results for '%s' (%d), retrying without year", title, year)
			return s.SearchMovie(title, 0)
		}
		return nil, nil
	}

	return &result.Results[0], nil
}

func (s *TMDBService) SearchTV(title string, year int) (*TMDBSearchResult, error) {
	if !s.IsConfigured() {
		return nil, fmt.Errorf("TMDB API key no configurada")
	}

	params := url.Values{}
	if s.authMethod == "apikey" {
		params.Set("api_key", s.apiKey)
	}
	params.Set("query", title)
	if year > 0 {
		params.Set("first_air_date_year", fmt.Sprintf("%d", year))
	}

	resp, err := s.doRequest("/search/tv", params)
	if err != nil {
		return nil, err
	}

	result, err := s.parseSearchResponse(resp)
	if err != nil {
		if year > 0 {
			log.Printf("INFO [TMDB] TV search with year=%d failed for '%s', retrying without year", year, title)
			return s.SearchTV(title, 0)
		}
		return nil, err
	}

	time.Sleep(250 * time.Millisecond) // rate limit

	if len(result.Results) == 0 {
		if year > 0 {
			log.Printf("INFO [TMDB] No TV results for '%s' (%d), retrying without year", title, year)
			return s.SearchTV(title, 0)
		}
		return nil, nil
	}

	return &result.Results[0], nil
}

func (s *TMDBService) SearchMulti(title string, year int, mediaType string) ([]TMDBSearchResult, error) {
	if !s.IsConfigured() {
		return nil, fmt.Errorf("TMDB API key no configurada")
	}

	// Use specific endpoint based on media type, or /search/multi for general search
	endpoint := "/search/multi"
	params := url.Values{}
	if s.authMethod == "apikey" {
		params.Set("api_key", s.apiKey)
	}
	params.Set("query", title)

	if mediaType == "series" || mediaType == "tv" {
		endpoint = "/search/tv"
		if year > 0 {
			params.Set("first_air_date_year", fmt.Sprintf("%d", year))
		}
	} else if mediaType == "movie" {
		endpoint = "/search/movie"
		if year > 0 {
			params.Set("year", fmt.Sprintf("%d", year))
		}
	}
	// For /search/multi, year filtering is not directly supported

	resp, err := s.doRequest(endpoint, params)
	if err != nil {
		return nil, err
	}

	result, err := s.parseSearchResponse(resp)
	if err != nil {
		return nil, err
	}

	time.Sleep(250 * time.Millisecond) // rate limit

	// Filter /search/multi results to only include movie and tv
	var filtered []TMDBSearchResult
	for _, r := range result.Results {
		if endpoint == "/search/multi" {
			if r.MediaType != "movie" && r.MediaType != "tv" {
				continue // skip person results, etc.
			}
		}
		filtered = append(filtered, r)
		if len(filtered) >= 10 {
			break
		}
	}

	// If no results with year, retry without year
	if len(filtered) == 0 && year > 0 {
		log.Printf("INFO [TMDB] No results for '%s' (%d), retrying without year", title, year)
		return s.SearchMulti(title, 0, mediaType)
	}

	return filtered, nil
}

func (s *TMDBService) PosterURL(path string) string {
	if path == "" {
		return ""
	}
	return s.imgBase + "w500" + path
}

func (s *TMDBService) BackdropURL(path string) string {
	if path == "" {
		return ""
	}
	return s.imgBase + "w1280" + path
}

func (s *TMDBService) GetYear(result *TMDBSearchResult) int {
	dateStr := result.ReleaseDate
	if dateStr == "" {
		dateStr = result.FirstAirDate
	}
	if len(dateStr) >= 4 {
		var year int
		fmt.Sscanf(dateStr[:4], "%d", &year)
		return year
	}
	return 0
}

func (s *TMDBService) GetTitle(result *TMDBSearchResult) string {
	if result.Title != "" {
		return result.Title
	}
	return result.Name
}

// ValidateAPIKey tests the TMDB API key/token by making a simple request
func (s *TMDBService) ValidateAPIKey() error {
	if !s.IsConfigured() {
		return fmt.Errorf("TMDB API key not configured")
	}

	params := url.Values{}
	if s.authMethod == "apikey" {
		params.Set("api_key", s.apiKey)
	}

	resp, err := s.doRequest("/configuration", params)
	if err != nil {
		return fmt.Errorf("TMDB validation failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("TMDB API key/token is invalid (401 Unauthorized)")
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("TMDB validation failed (HTTP %d): %s", resp.StatusCode, string(body))
	}

	log.Println("INFO [TMDB] API key validated successfully")
	return nil
}

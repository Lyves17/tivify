package service

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTMDBService_NewWithAPIKey(t *testing.T) {
	svc := NewTMDBService("abc123def456")
	if !svc.IsConfigured() {
		t.Error("should be configured with API key")
	}
	if svc.authMethod != "apikey" {
		t.Errorf("authMethod = %q, want %q", svc.authMethod, "apikey")
	}
}

func TestTMDBService_NewWithBearerToken(t *testing.T) {
	// Simulate a v4 token starting with "eyJ" and over 100 chars
	token := "eyJ" + string(make([]byte, 200))
	svc := NewTMDBService(token)
	if !svc.IsConfigured() {
		t.Error("should be configured with bearer token")
	}
	if svc.authMethod != "bearer" {
		t.Errorf("authMethod = %q, want %q", svc.authMethod, "bearer")
	}
}

func TestTMDBService_NotConfigured(t *testing.T) {
	svc := NewTMDBService("")
	if svc.IsConfigured() {
		t.Error("should not be configured with empty key")
	}
}

func TestTMDBService_SearchMovie_NotConfigured(t *testing.T) {
	svc := NewTMDBService("")
	_, err := svc.SearchMovie("test", 0)
	if err == nil {
		t.Error("expected error when not configured")
	}
}

func TestTMDBService_SearchTV_NotConfigured(t *testing.T) {
	svc := NewTMDBService("")
	_, err := svc.SearchTV("test", 0)
	if err == nil {
		t.Error("expected error when not configured")
	}
}

func TestTMDBService_SearchMulti_NotConfigured(t *testing.T) {
	svc := NewTMDBService("")
	_, err := svc.SearchMulti("test", 0, "")
	if err == nil {
		t.Error("expected error when not configured")
	}
}

func TestTMDBService_PosterURL(t *testing.T) {
	svc := NewTMDBService("test-key")
	url := svc.PosterURL("/abc.jpg")
	want := "https://image.tmdb.org/t/p/w500/abc.jpg"
	if url != want {
		t.Errorf("PosterURL = %q, want %q", url, want)
	}
}

func TestTMDBService_PosterURL_Empty(t *testing.T) {
	svc := NewTMDBService("test-key")
	url := svc.PosterURL("")
	if url != "" {
		t.Errorf("PosterURL = %q, want empty string", url)
	}
}

func TestTMDBService_BackdropURL(t *testing.T) {
	svc := NewTMDBService("test-key")
	url := svc.BackdropURL("/bg.jpg")
	want := "https://image.tmdb.org/t/p/w1280/bg.jpg"
	if url != want {
		t.Errorf("BackdropURL = %q, want %q", url, want)
	}
}

func TestTMDBService_BackdropURL_Empty(t *testing.T) {
	svc := NewTMDBService("test-key")
	url := svc.BackdropURL("")
	if url != "" {
		t.Errorf("BackdropURL = %q, want empty string", url)
	}
}

func TestTMDBService_GetTitle(t *testing.T) {
	svc := NewTMDBService("test-key")

	// Movie result (has Title)
	result := &TMDBSearchResult{Title: "Inception", Name: ""}
	if title := svc.GetTitle(result); title != "Inception" {
		t.Errorf("GetTitle = %q, want %q", title, "Inception")
	}

	// TV result (has Name, no Title)
	result = &TMDBSearchResult{Title: "", Name: "Breaking Bad"}
	if title := svc.GetTitle(result); title != "Breaking Bad" {
		t.Errorf("GetTitle = %q, want %q", title, "Breaking Bad")
	}
}

func TestTMDBService_GetYear(t *testing.T) {
	svc := NewTMDBService("test-key")

	// Movie with release date
	result := &TMDBSearchResult{ReleaseDate: "2010-07-16"}
	if year := svc.GetYear(result); year != 2010 {
		t.Errorf("GetYear = %d, want 2010", year)
	}

	// TV with first air date
	result = &TMDBSearchResult{FirstAirDate: "2008-01-20"}
	if year := svc.GetYear(result); year != 2008 {
		t.Errorf("GetYear = %d, want 2008", year)
	}

	// No date
	result = &TMDBSearchResult{}
	if year := svc.GetYear(result); year != 0 {
		t.Errorf("GetYear = %d, want 0", year)
	}
}

func TestTMDBService_ValidateAPIKey_NotConfigured(t *testing.T) {
	svc := NewTMDBService("")
	err := svc.ValidateAPIKey()
	if err == nil {
		t.Error("expected error when not configured")
	}
}

func TestTMDBService_SearchMovie_WithMockServer(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := tmdbSearchResponse{
			Page:         1,
			TotalResults: 1,
			Results: []TMDBSearchResult{
				{ID: 123, Title: "Test Movie", ReleaseDate: "2020-01-01"},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	result, err := svc.SearchMovie("Test Movie", 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == nil {
		t.Fatal("expected result, got nil")
	}
	if result.Title != "Test Movie" {
		t.Errorf("title = %q, want %q", result.Title, "Test Movie")
	}
}

func TestTMDBService_SearchMovie_NoResults(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := tmdbSearchResponse{Page: 1, TotalResults: 0, Results: []TMDBSearchResult{}}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	result, err := svc.SearchMovie("nonexistent", 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != nil {
		t.Error("expected nil result for no matches")
	}
}

func TestTMDBService_ValidateAPIKey_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"images":{}}`))
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	err := svc.ValidateAPIKey()
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestTMDBService_ValidateAPIKey_Unauthorized(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"status_message":"Invalid API key"}`))
	}))
	defer server.Close()

	svc := NewTMDBService("bad-key")
	svc.baseURL = server.URL

	err := svc.ValidateAPIKey()
	if err == nil {
		t.Error("expected error for unauthorized")
	}
}

func TestTMDBService_SearchTV_WithMockServer(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := tmdbSearchResponse{
			Page:         1,
			TotalResults: 1,
			Results: []TMDBSearchResult{
				{ID: 456, Name: "Test TV Show", FirstAirDate: "2019-05-01"},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	result, err := svc.SearchTV("Test TV Show", 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == nil {
		t.Fatal("expected result, got nil")
	}
	if result.Name != "Test TV Show" {
		t.Errorf("name = %q, want %q", result.Name, "Test TV Show")
	}
	if result.ID != 456 {
		t.Errorf("ID = %d, want 456", result.ID)
	}
}

func TestTMDBService_SearchTV_NoResults(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := tmdbSearchResponse{Page: 1, TotalResults: 0, Results: []TMDBSearchResult{}}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	result, err := svc.SearchTV("nonexistent", 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != nil {
		t.Error("expected nil result for no matches")
	}
}

func TestTMDBService_SearchMulti_WithMockServer(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check which endpoint was hit
		path := r.URL.Path
		resp := tmdbSearchResponse{
			Page:         1,
			TotalResults: 2,
			Results: []TMDBSearchResult{
				{ID: 1, Title: "Movie Result", MediaType: "movie"},
				{ID: 2, Name: "TV Result", MediaType: "tv"},
			},
		}
		_ = path
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	t.Run("multi_search", func(t *testing.T) {
		results, err := svc.SearchMulti("test", 0, "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(results) != 2 {
			t.Errorf("len(results) = %d, want 2", len(results))
		}
	})

	t.Run("movie_search", func(t *testing.T) {
		results, err := svc.SearchMulti("test", 2020, "movie")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(results) == 0 {
			t.Error("expected results")
		}
	})

	t.Run("tv_search", func(t *testing.T) {
		results, err := svc.SearchMulti("test", 0, "series")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(results) == 0 {
			t.Error("expected results")
		}
	})
}

func TestTMDBService_SearchMulti_FiltersPersonResults(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := tmdbSearchResponse{
			Page:         1,
			TotalResults: 3,
			Results: []TMDBSearchResult{
				{ID: 1, Title: "Movie", MediaType: "movie"},
				{ID: 2, Name: "Person", MediaType: "person"},
				{ID: 3, Name: "Show", MediaType: "tv"},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	results, err := svc.SearchMulti("test", 0, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should filter out "person" results
	if len(results) != 2 {
		t.Errorf("len(results) = %d, want 2 (person filtered out)", len(results))
	}
}

func TestTMDBService_SearchMovie_APIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"status_message":"Internal error","status_code":500}`))
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	_, err := svc.SearchMovie("test", 0)
	if err == nil {
		t.Error("expected error for API error response")
	}
}

func TestTMDBService_ValidateAPIKey_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`server error`))
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	err := svc.ValidateAPIKey()
	if err == nil {
		t.Error("expected error for server error")
	}
}

func TestTMDBService_BearerAuth_Request(t *testing.T) {
	var authHeader string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader = r.Header.Get("Authorization")
		resp := tmdbSearchResponse{Page: 1, Results: []TMDBSearchResult{{ID: 1, Title: "Test"}}}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	// Create a bearer token (must start with "eyJ" and be >100 chars)
	// Use printable chars to avoid URL encoding issues
	token := "eyJhbGciOiJIUzI1NiJ9." + "abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789"
	svc := NewTMDBService(token)
	svc.baseURL = server.URL

	svc.SearchMovie("test", 0)

	if authHeader == "" {
		t.Error("expected Authorization header to be set")
	}
	if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
		t.Errorf("expected Bearer auth, got %q", authHeader)
	}
}

func TestTMDBService_GetYear_ShortDate(t *testing.T) {
	svc := NewTMDBService("test-key")
	result := &TMDBSearchResult{ReleaseDate: "20"}
	year := svc.GetYear(result)
	if year != 0 {
		t.Errorf("GetYear with short date = %d, want 0", year)
	}
}

func TestTMDBService_SearchMovie_YearFallback(t *testing.T) {
	// Server that returns no results for year search but results without year
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		yearParam := r.URL.Query().Get("year")
		if yearParam != "" {
			// First call with year: return empty results
			w.Write([]byte(`{"results":[],"total_results":0}`))
		} else {
			// Second call without year: return a result
			w.Write([]byte(`{"results":[{"id":1,"title":"Test Movie","release_date":"2024-01-01","poster_path":"/poster.jpg"}],"total_results":1}`))
		}
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	result, err := svc.SearchMovie("Test Movie", 2024)
	if err != nil {
		t.Fatalf("SearchMovie() error: %v", err)
	}
	if result == nil {
		t.Fatal("expected a result from fallback search")
	}
	if callCount < 2 {
		t.Errorf("expected at least 2 calls (year + fallback), got %d", callCount)
	}
}

func TestTMDBService_SearchTV_YearFallback(t *testing.T) {
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		yearParam := r.URL.Query().Get("first_air_date_year")
		if yearParam != "" {
			w.Write([]byte(`{"results":[],"total_results":0}`))
		} else {
			w.Write([]byte(`{"results":[{"id":1,"name":"Test Show","first_air_date":"2024-01-01","poster_path":"/poster.jpg"}],"total_results":1}`))
		}
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	result, err := svc.SearchTV("Test Show", 2024)
	if err != nil {
		t.Fatalf("SearchTV() error: %v", err)
	}
	if result == nil {
		t.Fatal("expected a result from fallback search")
	}
	if callCount < 2 {
		t.Errorf("expected at least 2 calls, got %d", callCount)
	}
}

func TestTMDBService_SearchMulti_NoResults(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"results":[],"total_results":0}`))
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	results, err := svc.SearchMulti("nonexistent", 0, "")
	if err != nil {
		t.Fatalf("SearchMulti() error: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d", len(results))
	}
}

func TestTMDBService_SearchMovie_InvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`not valid json`))
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	_, err := svc.SearchMovie("Test", 0)
	if err == nil {
		t.Error("SearchMovie() should return error for invalid JSON")
	}
}

func TestTMDBService_SearchMulti_YearFallback(t *testing.T) {
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		yearParam := r.URL.Query().Get("year")
		airParam := r.URL.Query().Get("first_air_date_year")
		if yearParam != "" || airParam != "" {
			w.Write([]byte(`{"results":[],"total_results":0}`))
		} else {
			w.Write([]byte(`{"results":[{"id":1,"title":"Result","media_type":"movie"}],"total_results":1}`))
		}
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	results, err := svc.SearchMulti("Test", 2020, "movie")
	if err != nil {
		t.Fatalf("SearchMulti() error: %v", err)
	}
	if len(results) == 0 {
		t.Error("expected results from year fallback")
	}
	if callCount < 2 {
		t.Errorf("expected at least 2 calls (year + fallback), got %d", callCount)
	}
}

func TestTMDBService_SearchMulti_TVWithYear(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		yearParam := r.URL.Query().Get("first_air_date_year")
		if yearParam == "2019" {
			w.Write([]byte(`{"results":[{"id":1,"name":"Show","first_air_date":"2019-01-01"}],"total_results":1}`))
		} else {
			w.Write([]byte(`{"results":[],"total_results":0}`))
		}
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	results, err := svc.SearchMulti("Show", 2019, "tv")
	if err != nil {
		t.Fatalf("SearchMulti() error: %v", err)
	}
	if len(results) != 1 {
		t.Errorf("expected 1 result, got %d", len(results))
	}
}

func TestTMDBService_SearchMovie_APIError_WithYearRetry(t *testing.T) {
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		if callCount == 1 {
			// First call with year: API error
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"status_message":"Server error","status_code":500}`))
		} else {
			// Retry without year: success
			w.Write([]byte(`{"results":[{"id":1,"title":"Fallback"}],"total_results":1}`))
		}
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	result, err := svc.SearchMovie("Test", 2020)
	if err != nil {
		t.Fatalf("expected fallback to succeed, got error: %v", err)
	}
	if result == nil {
		t.Fatal("expected result from fallback")
	}
}

func TestTMDBService_SearchTV_APIError_WithYearRetry(t *testing.T) {
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		if callCount == 1 {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"status_message":"Server error","status_code":500}`))
		} else {
			w.Write([]byte(`{"results":[{"id":1,"name":"Fallback Show"}],"total_results":1}`))
		}
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	result, err := svc.SearchTV("Test", 2020)
	if err != nil {
		t.Fatalf("expected fallback to succeed, got error: %v", err)
	}
	if result == nil {
		t.Fatal("expected result from fallback")
	}
}

func TestTMDBService_SearchMovie_WithYear(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		yearParam := r.URL.Query().Get("year")
		if yearParam == "2020" {
			w.Write([]byte(`{"results":[{"id":1,"title":"Movie 2020"}],"total_results":1}`))
		} else {
			w.Write([]byte(`{"results":[],"total_results":0}`))
		}
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	result, err := svc.SearchMovie("Movie", 2020)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == nil || result.Title != "Movie 2020" {
		t.Errorf("expected 'Movie 2020', got %v", result)
	}
}

func TestTMDBService_SearchTV_WithYear(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		yearParam := r.URL.Query().Get("first_air_date_year")
		if yearParam == "2019" {
			w.Write([]byte(`{"results":[{"id":1,"name":"Show 2019"}],"total_results":1}`))
		} else {
			w.Write([]byte(`{"results":[],"total_results":0}`))
		}
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	result, err := svc.SearchTV("Show", 2019)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == nil || result.Name != "Show 2019" {
		t.Errorf("expected 'Show 2019', got %v", result)
	}
}

func TestTMDBService_SearchMulti_Max10Results(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var results []TMDBSearchResult
		for i := 0; i < 15; i++ {
			results = append(results, TMDBSearchResult{ID: i, Title: "Movie", MediaType: "movie"})
		}
		resp := tmdbSearchResponse{Results: results, TotalResults: 15}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	results, err := svc.SearchMulti("test", 0, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 10 {
		t.Errorf("expected max 10 results, got %d", len(results))
	}
}

func TestTMDBService_SearchMulti_APIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"status_message":"error"}`))
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	_, err := svc.SearchMulti("test", 0, "")
	if err == nil {
		t.Error("expected error")
	}
}

func TestTMDBService_ParseSearchResponse_NonJSONError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`not json error body`))
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	_, err := svc.SearchMovie("test", 0)
	if err == nil {
		t.Error("expected error for non-JSON error body")
	}
}

func TestTMDBService_ValidateAPIKey_BearerAuth(t *testing.T) {
	var gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"images":{}}`))
	}))
	defer server.Close()

	token := "eyJhbGciOiJIUzI1NiJ9." + "abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789"
	svc := NewTMDBService(token)
	svc.baseURL = server.URL

	err := svc.ValidateAPIKey()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotAuth == "" || gotAuth[:7] != "Bearer " {
		t.Errorf("expected Bearer auth header, got %q", gotAuth)
	}
}

func TestTMDBService_DoRequest_SetsLanguage(t *testing.T) {
	var gotLang string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotLang = r.URL.Query().Get("language")
		w.Write([]byte(`{"results":[]}`))
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	svc.SearchMovie("test", 0)
	if gotLang != "es-ES" {
		t.Errorf("expected language=es-ES, got %q", gotLang)
	}
}

func TestTMDBService_GetYear_BothDates(t *testing.T) {
	svc := NewTMDBService("test-key")
	// When both dates present, ReleaseDate takes precedence
	result := &TMDBSearchResult{ReleaseDate: "2010-07-16", FirstAirDate: "2008-01-20"}
	if year := svc.GetYear(result); year != 2010 {
		t.Errorf("GetYear = %d, want 2010 (ReleaseDate takes precedence)", year)
	}
}

func TestTMDBService_SearchTV_NoResults_NoYear(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"results":[],"total_results":0}`))
	}))
	defer server.Close()

	svc := NewTMDBService("test-key")
	svc.baseURL = server.URL

	result, err := svc.SearchTV("nonexistent", 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != nil {
		t.Error("expected nil for no results without year")
	}
}

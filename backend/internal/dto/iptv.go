package dto

// IPTVImportRequest es el body del endpoint POST /admin/iptv/import
type IPTVImportRequest struct {
	// M3UURL a importar. Por defecto: https://iptv-org.github.io/iptv/index.m3u
	M3UURL string `json:"m3u_url"`

	// EPGURL sobreescribe la URL de EPG del M3U (opcional)
	EPGURL string `json:"epg_url"`

	// Countries filtra por tvg-country. Vacío = todos los países.
	// Ejemplo: ["ES","MX","AR"]
	Countries []string `json:"countries"`

	// Languages filtra por tvg-language. Vacío = todos los idiomas.
	// Ejemplo: ["Spanish","English"]
	Languages []string `json:"languages"`

	// Categories filtra por group-title. Vacío = todas las categorías.
	// Ejemplo: ["News","Sports","Entertainment"]
	Categories []string `json:"categories"`

	// Replace = true → elimina los canales IPTV de la misma fuente antes de importar.
	// Los canales manuales (source="") NUNCA se tocan.
	Replace bool `json:"replace"`

	// Source es el identificador de fuente para los canales importados.
	// Por defecto: "iptv-org"
	Source string `json:"source"`
}

// IPTVStatusResponse es la respuesta del endpoint GET /admin/iptv/status
type IPTVStatusResponse struct {
	Running  bool   `json:"running"`
	Total    int    `json:"total"`
	Current  int    `json:"current"`
	Percent  int    `json:"percent"`
	Message  string `json:"message"`
	Error    string `json:"error,omitempty"`
	Imported int    `json:"imported"`
}

// IPTVDeleteResponse es la respuesta del endpoint DELETE /admin/iptv/channels
type IPTVDeleteResponse struct {
	Source  string `json:"source"`
	Message string `json:"message"`
}

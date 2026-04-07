package version

// Set at build time via -ldflags
var (
	Version   = "dev"
	BuildDate = "unknown"
)

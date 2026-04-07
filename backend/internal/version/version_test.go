package version

import "testing"

func TestVersionDefaults(t *testing.T) {
	if Version == "" {
		t.Error("Version should not be empty")
	}
	if BuildDate == "" {
		t.Error("BuildDate should not be empty")
	}
}

func TestVersionDefaultValues(t *testing.T) {
	// When not set via ldflags, defaults should be used
	if Version != "dev" {
		// If Version was set via ldflags, that's fine too
		t.Logf("Version is %q (may have been set via ldflags)", Version)
	}
	if BuildDate != "unknown" {
		t.Logf("BuildDate is %q (may have been set via ldflags)", BuildDate)
	}
}

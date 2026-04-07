package database

import (
	"log"

	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

func RunMigrations(db *gorm.DB) {
	log.Println("Ejecutando migraciones...")

	err := db.AutoMigrate(
		&model.User{},
		&model.Category{},
		&model.Channel{},
		&model.Stream{},
		&model.Series{},
		&model.VOD{},
		&model.EPGEntry{},
		&model.Favorite{},
		&model.WatchHistory{},
		&model.Session{},
		&model.StreamToken{},
		&model.LocalMedia{},
		&model.Playlist{},
		&model.PlaylistItem{},
		&model.Emission{},
		&model.LibraryScanItem{},
	)
	if err != nil {
		log.Fatalf("Error en migraciones: %v", err)
	}

	// Add indexes on foreign key columns
	log.Println("Agregando indices...")

	// Channel foreign keys
	db.Migrator().CreateIndex(&model.Channel{}, "category_id")

	// Stream foreign keys
	db.Migrator().CreateIndex(&model.Stream{}, "channel_id")

	// VOD foreign keys
	db.Migrator().CreateIndex(&model.VOD{}, "category_id")
	db.Migrator().CreateIndex(&model.VOD{}, "series_id")

	// EPGEntry foreign keys
	db.Migrator().CreateIndex(&model.EPGEntry{}, "channel_id")

	// Composite index on favorites for common queries (user_id + type)
	db.Migrator().CreateIndex(&model.Favorite{}, "user_id,favoritable_type")

	// Composite index on watch history (user_id + content_type) for resume queries
	db.Migrator().CreateIndex(&model.WatchHistory{}, "user_id,content_type")

	// Session foreign key
	db.Migrator().CreateIndex(&model.Session{}, "user_id")

	// LocalMedia indexes
	db.Migrator().CreateIndex(&model.LocalMedia{}, "status")

	// Playlist foreign keys
	db.Migrator().CreateIndex(&model.Playlist{}, "channel_id")
	db.Migrator().CreateIndex(&model.PlaylistItem{}, "playlist_id")

	// LibraryScanItem indexes
	db.Migrator().CreateIndex(&model.LibraryScanItem{}, "status")

	// Full-Text Search: search_vector columns, GIN indexes, and auto-update triggers
	setupFullTextSearch(db)

	log.Println("Migraciones completadas")
}

// setupFullTextSearch creates tsvector columns, GIN indexes, and triggers for FTS.
// Uses 'spanish' text search configuration. Safe to run multiple times (IF NOT EXISTS).
func setupFullTextSearch(db *gorm.DB) {
	log.Println("Configurando Full-Text Search...")

	ftsStatements := []string{
		// Channels: search on name
		`ALTER TABLE channels ADD COLUMN IF NOT EXISTS search_vector tsvector`,
		`CREATE INDEX IF NOT EXISTS idx_channels_search_vector ON channels USING GIN(search_vector)`,
		`CREATE OR REPLACE FUNCTION channels_search_vector_update() RETURNS trigger AS $$
		BEGIN
			NEW.search_vector := to_tsvector('spanish', COALESCE(NEW.name, ''));
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql`,
		`DROP TRIGGER IF EXISTS trg_channels_search_vector ON channels`,
		`CREATE TRIGGER trg_channels_search_vector BEFORE INSERT OR UPDATE OF name ON channels
		FOR EACH ROW EXECUTE FUNCTION channels_search_vector_update()`,
		// Backfill existing rows
		`UPDATE channels SET search_vector = to_tsvector('spanish', COALESCE(name, '')) WHERE search_vector IS NULL`,

		// VODs: search on title + description
		`ALTER TABLE vods ADD COLUMN IF NOT EXISTS search_vector tsvector`,
		`CREATE INDEX IF NOT EXISTS idx_vods_search_vector ON vods USING GIN(search_vector)`,
		`CREATE OR REPLACE FUNCTION vods_search_vector_update() RETURNS trigger AS $$
		BEGIN
			NEW.search_vector := setweight(to_tsvector('spanish', COALESCE(NEW.title, '')), 'A') ||
				setweight(to_tsvector('spanish', COALESCE(NEW.description, '')), 'B');
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql`,
		`DROP TRIGGER IF EXISTS trg_vods_search_vector ON vods`,
		`CREATE TRIGGER trg_vods_search_vector BEFORE INSERT OR UPDATE OF title, description ON vods
		FOR EACH ROW EXECUTE FUNCTION vods_search_vector_update()`,
		`UPDATE vods SET search_vector = setweight(to_tsvector('spanish', COALESCE(title, '')), 'A') ||
			setweight(to_tsvector('spanish', COALESCE(description, '')), 'B') WHERE search_vector IS NULL`,

		// Series: search on title + description
		`ALTER TABLE series ADD COLUMN IF NOT EXISTS search_vector tsvector`,
		`CREATE INDEX IF NOT EXISTS idx_series_search_vector ON series USING GIN(search_vector)`,
		`CREATE OR REPLACE FUNCTION series_search_vector_update() RETURNS trigger AS $$
		BEGIN
			NEW.search_vector := setweight(to_tsvector('spanish', COALESCE(NEW.title, '')), 'A') ||
				setweight(to_tsvector('spanish', COALESCE(NEW.description, '')), 'B');
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql`,
		`DROP TRIGGER IF EXISTS trg_series_search_vector ON series`,
		`CREATE TRIGGER trg_series_search_vector BEFORE INSERT OR UPDATE OF title, description ON series
		FOR EACH ROW EXECUTE FUNCTION series_search_vector_update()`,
		`UPDATE series SET search_vector = setweight(to_tsvector('spanish', COALESCE(title, '')), 'A') ||
			setweight(to_tsvector('spanish', COALESCE(description, '')), 'B') WHERE search_vector IS NULL`,
	}

	for _, stmt := range ftsStatements {
		if err := db.Exec(stmt).Error; err != nil {
			log.Printf("FTS migration warning: %v", err)
		}
	}

	log.Println("Full-Text Search configurado")
}

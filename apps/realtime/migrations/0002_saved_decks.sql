-- Saved decks (spec 05 §8.2). Owned by the Better Auth `user.id` in the same D1 database.
CREATE TABLE IF NOT EXISTS saved_decks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  -- Original builder stores the raw decklist text plus normalized entries; keep both.
  decklist_raw TEXT NOT NULL DEFAULT '',
  deck_sections_json TEXT NOT NULL DEFAULT '{}',
  -- Optional compact share code when the builder saved one.
  deck_code TEXT,
  guide_html TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  legality_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready', 'incomplete')),
  identity TEXT NOT NULL DEFAULT '',
  feature_card_id TEXT,
  feature_card_image_url TEXT,
  -- Publication is out of scope; reserved so summaries keep the original shape.
  published_deck_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_decks_user_recent
  ON saved_decks (user_id, last_used_at DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_decks_user_updated
  ON saved_decks (user_id, updated_at DESC);

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  deadline TEXT,
  city TEXT,
  mode TEXT,
  organizer TEXT,
  poster_key TEXT,
  website TEXT,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_competitions_deadline
ON competitions(deadline);

CREATE INDEX IF NOT EXISTS idx_competitions_status
ON competitions(status);

CREATE TABLE IF NOT EXISTS flashes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'published'
);

CREATE INDEX IF NOT EXISTS idx_flashes_published_at
ON flashes(published_at DESC);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  tag TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_articles_sort
ON articles(sort_order, updated_at DESC);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO meta(key, value) VALUES ('schema_version', '1');

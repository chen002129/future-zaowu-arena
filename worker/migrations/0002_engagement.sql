PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  provider TEXT,
  provider_uid TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_active_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_uid)
);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user
ON user_sessions(user_id);

CREATE TABLE IF NOT EXISTS event_stats (
  event_id TEXT PRIMARY KEY,
  likes INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  registration_clicks INTEGER NOT NULL DEFAULT 0,
  heat REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_stats_heat
ON event_stats(heat DESC);

CREATE TABLE IF NOT EXISTS event_user_state (
  event_id TEXT NOT NULL,
  actor_key TEXT NOT NULL,
  user_id TEXT,
  client_id TEXT,
  liked INTEGER NOT NULL DEFAULT 0,
  saved INTEGER NOT NULL DEFAULT 0,
  first_view_at TEXT,
  last_view_at TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  registration_click_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(event_id, actor_key),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_event_user_state_user
ON event_user_state(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS event_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  actor_key TEXT NOT NULL,
  user_id TEXT,
  client_id TEXT,
  action TEXT NOT NULL CHECK(action IN ('view','like','unlike','save','unsave','registration_click')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_event_activity_user
ON event_activity(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_activity_event
ON event_activity(event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS deadline_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  old_deadline TEXT,
  new_deadline TEXT,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source TEXT
);

CREATE INDEX IF NOT EXISTS idx_deadline_history_event
ON deadline_history(event_id, changed_at DESC);

UPDATE meta SET value='2', updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
INSERT OR IGNORE INTO meta(key,value) VALUES('schema_version','2');

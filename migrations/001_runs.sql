-- Which agent runs got which Craft app, how (headless or live) and how it ended. One row per run and app; the page
-- shows the latest ones. Plain INTEGER key plus an explicit unique index: an inline UNIQUE would make SQLite create an
-- autoindex, which the plugin SQL guard refuses.
CREATE TABLE {{runs}} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  task_code TEXT NOT NULL,
  app TEXT NOT NULL,
  mode TEXT NOT NULL,
  confined INTEGER NOT NULL,
  version TEXT,
  status TEXT NOT NULL DEFAULT 'starting',
  started_at TEXT NOT NULL,
  ended_at TEXT
);
CREATE UNIQUE INDEX {{runs}}_key ON {{runs}} (run_id, app);
CREATE INDEX {{runs}}_recent ON {{runs}} (workspace_id, started_at);

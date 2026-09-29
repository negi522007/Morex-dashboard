-- POC — the two tables that matter most for this app (users owning widget instances,
-- the scheduler's "which widgets are due" query) in MySQL instead of PostgreSQL.
-- Simplified from backend/prisma/schema.prisma's User/WidgetInstance models: only the
-- columns the due-query and the JSON-storage question actually need.

CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE widget_instances (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  service_name VARCHAR(64) NOT NULL,
  widget_name VARCHAR(64) NOT NULL,
  config JSON NOT NULL,
  refresh_rate_seconds INT NOT NULL,
  last_refreshed_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO users (id, email) VALUES ('u1', 'ada@example.com');
INSERT INTO widget_instances (id, user_id, service_name, widget_name, config, refresh_rate_seconds, last_refreshed_at) VALUES
  ('w1', 'u1', 'rss', 'article_list', JSON_OBJECT('link', 'https://hnrss.org/frontpage', 'number', 3), 60, NOW() - INTERVAL 90 SECOND), -- due
  ('w2', 'u1', 'weather', 'current_weather', JSON_OBJECT('city', 'Cotonou'), 300, NOW() - INTERVAL 10 SECOND); -- not due

-- The exact query TimerService.handleTick runs (see backend/src/timer/timer.service.ts),
-- translated from Postgres to MySQL syntax:
--   Postgres: WHERE "lastRefreshedAt" IS NULL OR "lastRefreshedAt" + ("refreshRateSeconds" * INTERVAL '1 second') <= NOW()
--   MySQL:    WHERE last_refreshed_at IS NULL OR last_refreshed_at + INTERVAL refresh_rate_seconds SECOND <= NOW()
-- Different interval syntax (MySQL has no "value * INTERVAL 'unit'" multiplication form —
-- INTERVAL takes a column/expression directly), otherwise a direct port.
SELECT id, service_name, widget_name, last_refreshed_at
FROM widget_instances
WHERE last_refreshed_at IS NULL
   OR last_refreshed_at + INTERVAL refresh_rate_seconds SECOND <= NOW();

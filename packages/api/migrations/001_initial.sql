-- Snip.ly initial schema (see knowledge/SYSTEM_DESIGN.md §4.1)

CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE links (
  id            BIGSERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  long_url      TEXT NOT NULL,
  user_id       UUID REFERENCES users (id),
  active        BOOLEAN NOT NULL DEFAULT true,
  click_count   BIGINT NOT NULL DEFAULT 0,
  expiry_at     TIMESTAMPTZ,
  max_clicks    INTEGER,
  password_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_links_code ON links (code);
CREATE INDEX idx_links_user_id ON links (user_id);
CREATE INDEX idx_links_active ON links (active);

CREATE TABLE click_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id    BIGINT NOT NULL REFERENCES links (id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  referrer   TEXT,
  country    CHAR(2),
  user_agent TEXT,
  ip_hash    TEXT NOT NULL
);

CREATE INDEX idx_click_events_link_id ON click_events (link_id);
CREATE INDEX idx_click_events_clicked_at ON click_events (clicked_at);
CREATE INDEX idx_click_events_link_time ON click_events (link_id, clicked_at);

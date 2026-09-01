CREATE TABLE IF NOT EXISTS birthdays (
  id         BIGSERIAL   PRIMARY KEY,
  guild_id   TEXT        NOT NULL,
  channel_id TEXT        NOT NULL,
  user_id    TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  send_at    TIMESTAMPTZ NOT NULL,
  sent       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

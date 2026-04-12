CREATE TABLE IF NOT EXISTS voice_sessions (
  id           BIGSERIAL    PRIMARY KEY,
  guild_id     TEXT         NOT NULL,
  user_id      TEXT         NOT NULL,
  channel_id   TEXT         NOT NULL,
  channel_name TEXT         NOT NULL,
  joined_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  left_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS command_logs (
  id         BIGSERIAL    PRIMARY KEY,
  guild_id   TEXT,
  user_id    TEXT         NOT NULL,
  command    TEXT         NOT NULL,
  used_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timers (
  id         BIGSERIAL    PRIMARY KEY,
  user_id    TEXT         NOT NULL,
  name       TEXT         NOT NULL,
  expires_at TIMESTAMPTZ  NOT NULL,
  fired      BOOLEAN      NOT NULL DEFAULT FALSE
);

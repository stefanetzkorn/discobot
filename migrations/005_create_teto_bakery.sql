CREATE TABLE teto_bakery (
  user_id            TEXT NOT NULL,
  guild_id           TEXT NOT NULL,
  bread              NUMERIC(20, 4) NOT NULL DEFAULT 0,
  last_collected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ovens              INTEGER NOT NULL DEFAULT 0,
  mega_ovens         INTEGER NOT NULL DEFAULT 0,
  secret_recipes     INTEGER NOT NULL DEFAULT 0,
  baguette_machines  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, guild_id)
);

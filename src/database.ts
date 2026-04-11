import { Database } from "bun:sqlite";

export function createDatabase(path: string): Database {
  const db = new Database(path, { create: true, strict: true });

  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA foreign_keys = ON;");

  db.run(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id   TEXT PRIMARY KEY,
      prefix     TEXT NOT NULL DEFAULT '/',
      language   TEXT NOT NULL DEFAULT 'en',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    ) STRICT;
  `);

  // left_at is NULL while the user is still in the channel.
  db.run(`
    CREATE TABLE IF NOT EXISTS voice_sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id     TEXT    NOT NULL,
      user_id      TEXT    NOT NULL,
      channel_id   TEXT    NOT NULL,
      channel_name TEXT    NOT NULL,
      joined_at    INTEGER NOT NULL,
      left_at      INTEGER
    ) STRICT;
  `);

  return db;
}

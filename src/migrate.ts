import { basename, join } from "node:path";
import { Glob } from "bun";
import { sql } from "./database.ts";

export async function runMigrations(): Promise<void> {
  // The migrations table tracks which files have already been applied.
  await sql`
    CREATE TABLE IF NOT EXISTS migrations (
      id         BIGSERIAL    PRIMARY KEY,
      name       TEXT         NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;

  const applied = await sql<{ name: string }[]>`SELECT name FROM migrations`;
  const appliedNames = new Set(applied.map((r) => r.name));

  const migrationsDir = join(import.meta.dir, "..", "migrations");
  const files: string[] = [];

  for await (const file of new Glob("*.sql").scan({ cwd: migrationsDir, absolute: true })) {
    files.push(file);
  }

  // Sort alphabetically so migrations run in numbered order.
  files.sort();

  for (const file of files) {
    const name = basename(file);
    if (appliedNames.has(name)) continue;

    console.log(`Applying migration: ${name}`);
    const content = await Bun.file(file).text();

    // Run the migration and record it in a single transaction so a
    // partial failure doesn't leave the migrations table out of sync.
    await sql.begin(async (tx) => {
      for (const statement of content.split(";").map((s) => s.trim()).filter(Boolean)) {
        await tx.unsafe(statement);
      }
      await tx`INSERT INTO migrations (name) VALUES (${name})`;
    });

    console.log(`Applied migration: ${name}`);
  }
}

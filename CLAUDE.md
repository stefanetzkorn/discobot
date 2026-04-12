Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `Bun.file` over `node:fs` readFile/writeFile.
- `Bun.$` instead of execa.

## Project overview

A Discord bot built with discord.js v14. Entry point is `index.ts`. Source code lives in `src/`.

```
src/
  types.ts               # Command interface — every command must satisfy this
  database.ts            # Exports the Bun.sql instance
  migrate.ts             # Runs pending SQL migrations from migrations/ on startup
  timer-scheduler.ts     # Schedules timer DMs, loads pending timers on restart
  client.ts              # Creates the discord.js Client with the right intents
  loader.ts              # Auto-discovers command files via Bun.Glob
  deploy-commands.ts     # Registers slash commands with Discord's REST API per guild
  commands/              # One file per slash command
  events/                # One file per Discord gateway event
migrations/              # Numbered .sql migration files (001_initial.sql, etc.)
```

Run the bot:

```sh
bun run index.ts
```

## Adding a command

Create a new `.ts` file in `src/commands/`. It must export a default object that satisfies the `Command` interface from `src/types.ts`. The loader auto-discovers it on the next startup — no other files need to change.

```ts
import { SlashCommandBuilder, MessageFlags } from "discord.js";
import type { Command } from "../types.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("example")
    .setDescription("An example command"),

  async execute(interaction) {
    await interaction.reply({ content: "Hello!", flags: [MessageFlags.Ephemeral] });
  },
} satisfies Command;
```

To query the database, import `sql` from `database.ts`:

```ts
import { sql } from "../database.ts";

const rows = await sql`SELECT * FROM command_logs WHERE user_id = ${interaction.user.id}`;
```

Use `satisfies Command` (not `as Command`) so TypeScript fully checks the shape.

## Adding an event handler

Create a new `.ts` file in `src/events/`. Export a `register*` function that takes a `Client`, then call it in `index.ts`.

## Database

- Postgres, running as a Docker service (`db`)
- Connection is configured via `DATABASE_URL` in `.env` — `Bun.sql` picks this up automatically
- Schema is managed through migrations in `migrations/` — add new tables there, never in `database.ts`

### Adding a migration

Create a new numbered `.sql` file in `migrations/`. It runs automatically on the next startup:

```sql
-- migrations/004_add_something.sql
ALTER TABLE voice_sessions ADD COLUMN foo TEXT;
```

Migrations run inside a transaction — if a statement fails, the whole file is rolled back.

### Tables

| Table | Purpose |
|---|---|
| `migrations` | Tracks which migration files have been applied |
| `voice_sessions` | Voice channel join/leave log; `left_at` is NULL while the user is still in the channel |
| `command_logs` | Every slash command invocation — who used it, where, and when |
| `timers` | Persistent timers set via `/timer`; `fired` is FALSE until the DM is sent |

Query total voice time per user:
```sql
SELECT user_id, EXTRACT(EPOCH FROM SUM(COALESCE(left_at, NOW()) - joined_at))::INTEGER AS seconds
FROM voice_sessions
GROUP BY user_id;
```

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Application ID (used to register slash commands) |
| `DATABASE_URL` | Postgres connection string — use `postgres://discobot:discobot@db:5432/discobot` for Docker |

## Key rules

- Always use `import.meta.dir` instead of `__dirname`
- `Glob.scan` must use `{ absolute: true }` so dynamic `import()` resolves correctly
- Slash commands are registered per guild (instant) via `Routes.applicationGuildCommands`
- Only request the Discord gateway intents you actually need (currently `Guilds` + `GuildVoiceStates`)
- Use `interaction.guildId` instead of `interaction.guild?.id` — the latter can be null if the bot was invited without the `bot` OAuth2 scope
- All replies should use `flags: [MessageFlags.Ephemeral]` unless the message is intentionally public

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.file` over `node:fs` readFile/writeFile.
- `Bun.$` instead of execa.

## Project overview

A Discord bot built with discord.js v14. Entry point is `index.ts`. Source code lives in `src/`.

```
src/
  types.ts               # Command interface — every command must satisfy this
  database.ts            # Opens bun:sqlite DB and creates tables on startup
  client.ts              # Creates the discord.js Client with the right intents
  loader.ts              # Auto-discovers command files via Bun.Glob
  deploy-commands.ts     # Registers slash commands with Discord's REST API
  commands/              # One file per slash command
  events/                # One file per Discord gateway event
```

Run the bot:

```sh
bun run index.ts
```

## Adding a command

Create a new `.ts` file in `src/commands/`. It must export a default object that satisfies the `Command` interface from `src/types.ts`. The loader auto-discovers it on the next startup — no other files need to change.

```ts
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("example")
    .setDescription("An example command"),

  async execute(interaction, db) {
    await interaction.reply("Hello!");
  },
} satisfies Command;
```

Use `satisfies Command` (not `as Command`) so TypeScript fully checks the shape.

## Adding an event handler

Create a new `.ts` file in `src/events/`. Export a `register*` function that takes a `Client` (and `db` if needed), then call it in `index.ts`.

## Database

- DB file: `data/bot.db` (git-ignored)
- Schema is defined in `src/database.ts` as `CREATE TABLE IF NOT EXISTS` blocks — add new tables there
- Use prepared statements (`db.prepare(...)`) for queries that run repeatedly (e.g. inside event handlers)
- Tables use SQLite STRICT mode — column types are enforced at the database level

### Tables

| Table | Purpose |
|---|---|
| `guild_settings` | Per-server config (prefix, language) |
| `voice_sessions` | Voice channel join/leave log; `left_at` is NULL while the user is still in the channel |

Query total voice time per user:
```sql
SELECT user_id, SUM(COALESCE(left_at, unixepoch()) - joined_at) AS seconds
FROM voice_sessions
GROUP BY user_id;
```

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Application ID (used to register slash commands) |
| `DISCORD_GUILD_ID` | Server ID for guild-scoped command registration (instant; switch to global for production) |

## Key rules

- Always use `import.meta.dir` instead of `__dirname`
- `Glob.scan` must use `{ absolute: true }` so dynamic `import()` resolves correctly
- Slash commands are guild-scoped (instant) — switch to `Routes.applicationCommands` for global production deployment
- Only request the Discord gateway intents you actually need (currently `Guilds` + `GuildVoiceStates`)

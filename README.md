# discobot

A Discord bot built with [Bun](https://bun.com), TypeScript, discord.js v14, and PostgreSQL.

## Setup

1. Clone the repo and install dependencies:

```bash
bun install
```

2. Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Where to find it |
|---|---|
| `DISCORD_TOKEN` | [Discord Developer Portal](https://discord.com/developers/applications) → Your app → Bot → Token |
| `DISCORD_CLIENT_ID` | Developer Portal → Your app → General Information → Application ID |
| `DATABASE_URL` | Set to `postgres://discobot:discobot@db:5432/discobot` for Docker |
| `BIRTHDAY_TIMEZONE` | IANA timezone for `/birthday` times, e.g. `Europe/Berlin` (optional — default UTC) |

3. Run the bot:

```bash
bun run index.ts
```

## Running with Docker

```bash
docker compose up -d
```

Logs:

```bash
docker compose logs -f
```

Postgres data is stored in `./pgdata` on the host.

## Exploring the database

Open an interactive Postgres session inside the running container:

```bash
docker exec -it discobot-db-1 psql -U discobot -d discobot
```

Useful queries:

```sql
-- Recent command usage
SELECT * FROM command_logs ORDER BY used_at DESC LIMIT 20;

-- Total voice time per user
SELECT user_id, SUM(EXTRACT(EPOCH FROM (COALESCE(left_at, NOW()) - joined_at)))::INTEGER AS seconds
FROM voice_sessions
GROUP BY user_id
ORDER BY seconds DESC;
```

Type `\dt` to list all tables, `\q` to quit.

## Project structure

```
src/
  commands/            # One file per slash command
  events/              # One file per Discord gateway event
  types.ts             # Command interface
  database.ts          # Exports the Bun.sql instance
  migrate.ts           # Runs pending migrations from migrations/ on startup
  timer-scheduler.ts   # Schedules timer DMs, reloads pending timers on restart
  birthday-scheduler.ts # Polls DB for due /birthday cards (supports far-future dates)
  client.ts            # Discord client factory
  loader.ts            # Auto-discovers command files
  deploy-commands.ts   # Registers commands with Discord per guild
migrations/            # Numbered .sql migration files
```

## Adding a slash command

Create a new `.ts` file in `src/commands/`. It will be picked up automatically on the next restart — no other files need to change.

```ts
// src/commands/example.ts
import { SlashCommandBuilder, MessageFlags } from "discord.js";
import type { Command } from "../types.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("example")
    .setDescription("An example command"),

  async execute(interaction) {
    await interaction.reply({
      content: "Hello!",
      flags: [MessageFlags.Ephemeral],
    });
  },
} satisfies Command;
```

To query the database from a command, import `sql` from `database.ts`:

```ts
import { sql } from "../database.ts";

const rows = await sql`SELECT * FROM command_logs WHERE user_id = ${interaction.user.id}`;
```

Use `satisfies Command` (not `as Command`) so TypeScript catches any structural errors.

## Adding an event handler

Create a new `.ts` file in `src/events/` that exports a `register*` function, then call it in `index.ts`:

```ts
// src/events/messageCreate.ts
import type { Client } from "discord.js";

export function registerMessageCreate(client: Client): void {
  client.on("messageCreate", (message) => {
    // handle message
  });
}
```

Then in `index.ts`:

```ts
import { registerMessageCreate } from "./src/events/messageCreate.ts";
// ...
registerMessageCreate(client);
```

## Adding a database table

Create a new numbered `.sql` file in `migrations/`. It runs automatically on the next startup:

```sql
-- migrations/004_add_something.sql
CREATE TABLE IF NOT EXISTS my_table (
  id         BIGSERIAL    PRIMARY KEY,
  guild_id   TEXT         NOT NULL,
  value      TEXT         NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

Migrations run inside a transaction — if a statement fails the whole file is rolled back.

## Database tables

| Table | Purpose |
|---|---|
| `migrations` | Tracks which migration files have been applied |
| `voice_sessions` | Voice channel join/leave history; `left_at` is NULL while the user is still in the channel |
| `command_logs` | Every slash command invocation — who used it, where, and when |
| `timers` | Persistent timers set via `/timer`; `fired` is FALSE until the DM is sent |
| `birthdays` | Birthday cards set via `/birthday`; `user_id` is who gets mentioned, `send_at` is when to post, `sent` is FALSE until posted |

## Notes

- Slash commands are registered per guild so they appear instantly (no propagation delay)
- When the bot joins a new server, commands are registered there automatically via the `guildCreate` event
- All replies should use `flags: [MessageFlags.Ephemeral]` to keep responses private
- Use `interaction.guildId` instead of `interaction.guild?.id` — the latter can be null if the bot was invited without the `bot` OAuth2 scope

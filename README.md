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
  commands/          # One file per slash command
  events/            # One file per Discord gateway event
  types.ts           # Command interface
  database.ts        # Database setup and schema
  client.ts          # Discord client factory
  loader.ts          # Auto-discovers command files
  deploy-commands.ts # Registers commands with Discord per guild
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

Add a `CREATE TABLE IF NOT EXISTS` block to `src/database.ts`. The table will be created automatically on the next startup:

```ts
await sql`
  CREATE TABLE IF NOT EXISTS my_table (
    id         BIGSERIAL    PRIMARY KEY,
    guild_id   TEXT         NOT NULL,
    value      TEXT         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )
`;
```

## Database tables

| Table | Purpose |
|---|---|
| `command_logs` | Every slash command invocation — who used it, where, and when |
| `voice_sessions` | Voice channel join/leave history; `left_at` is NULL while the user is still in the channel |

## Notes

- Slash commands are registered per guild so they appear instantly (no propagation delay)
- When the bot joins a new server, commands are registered there automatically via the `guildCreate` event
- All replies should use `flags: [MessageFlags.Ephemeral]` to keep responses private
- Use `interaction.guildId` instead of `interaction.guild?.id` — the latter can be null if the bot was invited without the `bot` OAuth2 scope

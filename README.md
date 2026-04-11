# discobot

A Discord bot built with [Bun](https://bun.com), TypeScript, discord.js v14, and SQLite.

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

The SQLite database is stored in `./data/bot.db` on the host.

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

  async execute(interaction, db) {
    await interaction.reply({
      content: "Hello!",
      flags: [MessageFlags.Ephemeral],
    });
  },
} satisfies Command;
```

The `db` parameter is a `bun:sqlite` `Database` instance — use it to read or write data:

```ts
const row = db.query("SELECT * FROM guild_settings WHERE guild_id = ?").get(interaction.guildId);
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
db.run(`
  CREATE TABLE IF NOT EXISTS my_table (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    value    TEXT NOT NULL
  ) STRICT;
`);
```

## Notes

- Slash commands are registered per guild so they appear instantly (no propagation delay)
- When the bot joins a new server, commands are registered there automatically via the `guildCreate` event
- All replies should use `flags: [MessageFlags.Ephemeral]` to keep responses private
- Use `interaction.guildId` instead of `interaction.guild?.id` — the latter can be null if the bot was invited without the `bot` OAuth2 scope

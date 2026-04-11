import { REST, Routes } from "discord.js";
import type { Command } from "./types.ts";

// Guild-scoped registration takes effect instantly. Switch to
// Routes.applicationCommands(clientId) for global production deployment.
export async function deployCommands(commands: Map<string, Command>): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId || !guildId) {
    throw new Error("Missing DISCORD_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID in environment");
  }

  const body = [...commands.values()].map((c) => c.data.toJSON());

  const rest = new REST().setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  console.log(`Deployed ${body.length} slash command(s) to guild ${guildId}`);
}

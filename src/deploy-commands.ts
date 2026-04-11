import { REST, Routes } from "discord.js";
import type { Command } from "./types.ts";

let rest: REST;

function getRestClient(): REST {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("Missing DISCORD_TOKEN in environment");
  // Reuse the same REST instance across calls instead of creating one per guild.
  rest ??= new REST().setToken(token);
  return rest;
}

export async function deployCommands(commands: Map<string, Command>, guildId: string): Promise<void> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) throw new Error("Missing DISCORD_CLIENT_ID in environment");

  const body = [...commands.values()].map((c) => c.data.toJSON());
  await getRestClient().put(Routes.applicationGuildCommands(clientId, guildId), { body });
  console.log(`Deployed ${body.length} slash command(s) to guild ${guildId}`);
}

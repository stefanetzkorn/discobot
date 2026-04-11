import { REST, Routes } from "discord.js";
import type { Command } from "./types.ts";

export async function deployCommands(commands: Map<string, Command>): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    throw new Error("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment");
  }

  const body = [...commands.values()].map((c) => c.data.toJSON());

  const rest = new REST().setToken(token);
  await rest.put(Routes.applicationCommands(clientId), { body });
  console.log(`Deployed ${body.length} slash command(s) globally`);
}

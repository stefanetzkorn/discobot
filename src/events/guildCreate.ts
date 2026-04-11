import type { Client } from "discord.js";
import type { Command } from "../types.ts";
import { deployCommands } from "../deploy-commands.ts";

export function registerGuildCreate(client: Client, commands: Map<string, Command>): void {
  // Fires when the bot joins a new server — register commands there immediately.
  client.on("guildCreate", async (guild) => {
    await deployCommands(commands, guild.id);
  });
}

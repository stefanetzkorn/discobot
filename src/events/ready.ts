import type { Client } from "discord.js";
import type { Command } from "../types.ts";
import { deployCommands } from "../deploy-commands.ts";

export function registerReadyEvent(client: Client, commands: Map<string, Command>): void {
  client.once("clientReady", async (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    // Register commands for every server the bot is currently in.
    for (const guild of c.guilds.cache.values()) {
      await deployCommands(commands, guild.id);
    }
  });
}

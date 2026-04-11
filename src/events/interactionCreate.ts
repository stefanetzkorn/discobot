import { MessageFlags } from "discord.js";
import type { Client } from "discord.js";
import type { Database } from "bun:sqlite";
import type { Command } from "../types.ts";

export function registerInteractionCreate(
  client: Client,
  commands: Map<string, Command>,
  db: Database,
): void {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) {
      console.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction, db);
    } catch (error) {
      console.error(`Error executing /${interaction.commandName}:`, error);

      // Discord requires a response within 3 seconds. If the command already
      // replied or deferred, use followUp instead of reply.
      const message = { content: "Something went wrong.", flags: [MessageFlags.Ephemeral] as const };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(message);
      } else {
        await interaction.reply(message);
      }
    }
  });
}

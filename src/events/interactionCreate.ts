import { MessageFlags } from "discord.js";
import type { Client } from "discord.js";
import type { Command } from "../types.ts";
import { sql } from "../database.ts";

export function registerInteractionCreate(
  client: Client,
  commands: Map<string, Command>,
): void {
  client.on("interactionCreate", async (interaction) => {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) {
        console.warn(`Unknown command: ${interaction.commandName}`);
        return;
      }

      try {
        await command.execute(interaction);
        await sql`
          INSERT INTO command_logs (guild_id, user_id, command)
          VALUES (${interaction.guildId}, ${interaction.user.id}, ${interaction.commandName})
        `;
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
      return;
    }

    if (interaction.isButton()) {
      // customId format: "<commandName>:<action>[:<param>]"
      const commandName = interaction.customId.split(":")[0];
      const command = commands.get(commandName ?? "");
      if (!command?.handleButton) return;

      try {
        await command.handleButton(interaction);
      } catch (error) {
        console.error(`Error handling button ${interaction.customId}:`, error);
        await interaction.reply({ content: "Something went wrong.", flags: [MessageFlags.Ephemeral] });
      }
    }
  });
}

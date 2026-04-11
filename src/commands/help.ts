import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import type { Command } from "../types.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("List all available commands"),

  async execute(interaction) {
    const commands = await interaction.client.application?.commands.fetch();

    const embed = new EmbedBuilder()
      .setTitle("Available Commands")
      .setColor(0x5865f2)
      .setDescription("Here are all the commands you can use:");

    if (commands && commands.size > 0) {
      embed.addFields(commands.map((cmd) => ({ name: `/${cmd.name}`, value: cmd.description, inline: true })));
    } else {
      embed.setDescription("No commands found.");
    }

    await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
  },
} satisfies Command;

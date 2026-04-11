import { SlashCommandBuilder, MessageFlags } from "discord.js";
import type { Command } from "../types.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency"),

  async execute(interaction) {
    await interaction.reply({
      content: `Pong! Latency: ${interaction.client.ws.ping}ms`,
      flags: [MessageFlags.Ephemeral],
    });
  },
} satisfies Command;

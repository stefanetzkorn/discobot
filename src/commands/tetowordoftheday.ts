import { SlashCommandBuilder, MessageFlags } from "discord.js";
import type { Command } from "../types.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("tetowordoftheday")
    .setDescription("Reveals Teto's word of the day"),

  async execute(interaction) {
    const response = await fetch("https://random-word-api.herokuapp.com/word");

    if (!response.ok) {
      await interaction.reply({ content: "Could not fetch the word of the day. Try again later.", flags: [MessageFlags.Ephemeral] });
      return;
    }

    const [word] = await response.json() as [string];

    await interaction.reply(`Teto's word of the day is: **${word}**`);
  },
} satisfies Command;

import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import type { Command } from "../types.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Show information about a user")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to look up (defaults to you)")
        .setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser("user") ?? interaction.user;
    const member = interaction.guild?.members.cache.get(target.id);

    const createdAt = Math.floor(target.createdTimestamp / 1000);
    const joinedAt = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

    const embed = new EmbedBuilder()
      .setTitle(target.tag)
      .setThumbnail(target.displayAvatarURL())
      .setColor(0x5865f2)
      .addFields(
        { name: "User ID", value: target.id, inline: true },
        { name: "Account Created", value: `<t:${createdAt}:R>`, inline: true },
      );

    if (joinedAt !== null) {
      embed.addFields({ name: "Joined Server", value: `<t:${joinedAt}:R>`, inline: true });
    }

    if (member?.nickname) {
      embed.addFields({ name: "Nickname", value: member.nickname, inline: true });
    }

    await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
  },
} satisfies Command;

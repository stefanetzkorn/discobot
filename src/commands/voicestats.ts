import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import type { Command } from "../types.ts";
import { sql } from "../database.ts";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h ${minutes % 60}m`;
}

export default {
  data: new SlashCommandBuilder()
    .setName("voicestats")
    .setDescription("See how long you have spent in voice channels"),

  async execute(interaction) {
    const userId = interaction.user.id;
    // guildId is used instead of interaction.guild?.id because the latter can be
    // null if the bot was invited without the bot scope.
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: [MessageFlags.Ephemeral] });
      return;
    }

    // COALESCE(left_at, NOW()) includes ongoing sessions by counting up to now.
    // EXTRACT(EPOCH FROM interval) converts a Postgres interval to seconds.
    const [totalRow] = await sql<{ total_seconds: number | null }[]>`
      SELECT EXTRACT(EPOCH FROM SUM(COALESCE(left_at, NOW()) - joined_at))::INTEGER AS total_seconds
      FROM voice_sessions
      WHERE user_id = ${userId} AND guild_id = ${guildId}
    `;

    const topChannels = await sql<{ channel_name: string; seconds: number }[]>`
      SELECT channel_name, EXTRACT(EPOCH FROM SUM(COALESCE(left_at, NOW()) - joined_at))::INTEGER AS seconds
      FROM voice_sessions
      WHERE user_id = ${userId} AND guild_id = ${guildId}
      GROUP BY channel_id, channel_name
      ORDER BY seconds DESC
      LIMIT 3
    `;

    const total = totalRow?.total_seconds ?? 0;

    const embed = new EmbedBuilder()
      .setTitle(`Voice stats for ${interaction.user.displayName}`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setColor(0x5865f2)
      .addFields({
        name: "Total time in voice",
        value: total > 0 ? formatDuration(total) : "No sessions recorded yet.",
      });

    if (topChannels.length > 0) {
      embed.addFields({
        name: "Top channels",
        value: topChannels.map((ch, i) => `${i + 1}. **${ch.channel_name}** — ${formatDuration(ch.seconds)}`).join("\n"),
      });
    }

    await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
  },
} satisfies Command;

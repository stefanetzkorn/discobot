import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import type { Command } from "../types.ts";

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

  async execute(interaction, db) {
    const userId = interaction.user.id;
    // guildId is used instead of interaction.guild?.id because the latter can be
    // null if the bot was invited without the bot scope.
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: [MessageFlags.Ephemeral] });
      return;
    }

    // COALESCE(left_at, unixepoch()) includes ongoing sessions by counting up to now.
    const totalRow = db
      .query<{ total_seconds: number }, [string, string]>(
        `SELECT SUM(COALESCE(left_at, unixepoch()) - joined_at) AS total_seconds
         FROM voice_sessions
         WHERE user_id = ? AND guild_id = ?`
      )
      .get(userId, guildId);

    const topChannels = db
      .query<{ channel_name: string; seconds: number }, [string, string]>(
        `SELECT channel_name, SUM(COALESCE(left_at, unixepoch()) - joined_at) AS seconds
         FROM voice_sessions
         WHERE user_id = ? AND guild_id = ?
         GROUP BY channel_id
         ORDER BY seconds DESC
         LIMIT 3`
      )
      .all(userId, guildId);

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

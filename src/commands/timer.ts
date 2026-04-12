import { SlashCommandBuilder, MessageFlags } from "discord.js";
import type { Command } from "../types.ts";
import { sql } from "../database.ts";
import { scheduleTimer } from "../timer-scheduler.ts";

// Parses strings like "10m", "1h", "30s", "1h30m", "2h15m30s" into milliseconds.
function parseDuration(input: string): number | null {
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(input.trim());
  if (!match || (!match[1] && !match[2] && !match[3])) return null;

  const hours   = parseInt(match[1] ?? "0");
  const minutes = parseInt(match[2] ?? "0");
  const seconds = parseInt(match[3] ?? "0");

  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

const MAX_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default {
  data: new SlashCommandBuilder()
    .setName("timer")
    .setDescription("Set a timer and get a DM when it finishes")
    .addStringOption((option) =>
      option
        .setName("duration")
        .setDescription("How long to wait (e.g. 10m, 1h, 30s, 1h30m)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("A label for this timer")
        .setRequired(false)
    ),

  async execute(interaction) {
    const durationStr = interaction.options.getString("duration", true);
    const name = interaction.options.getString("name") ?? "Timer";

    const ms = parseDuration(durationStr);
    if (!ms || ms < 1000) {
      await interaction.reply({ content: "Invalid duration. Use formats like `10m`, `1h`, `30s`, or `1h30m`.", flags: [MessageFlags.Ephemeral] });
      return;
    }

    if (ms > MAX_MS) {
      await interaction.reply({ content: "Maximum timer duration is 7 days.", flags: [MessageFlags.Ephemeral] });
      return;
    }

    const expiresAt = new Date(Date.now() + ms);

    const [row] = await sql<{ id: number }[]>`
      INSERT INTO timers (user_id, name, expires_at)
      VALUES (${interaction.user.id}, ${name}, ${expiresAt})
      RETURNING id
    `;

    if (!row) throw new Error("Failed to insert timer");

    scheduleTimer(interaction.client, row.id, interaction.user.id, name, expiresAt);

    await interaction.reply({ content: `Timer **${name}** set for ${durationStr}. I'll DM you when it's done.`, flags: [MessageFlags.Ephemeral] });
  },
} satisfies Command;

import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DateTime } from "luxon";
import type { Command } from "../types.ts";
import { sql } from "../database.ts";
import { nextYearlyOccurrence } from "../birthday-scheduler.ts";

const MAX_NAME_LENGTH = 30;

interface DateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

// Parses "YYYY-MM-DD" plus an optional "HH:MM" time (24h, default 09:00).
function parseDateTime(dateStr: string, timeStr: string | null): DateTimeParts | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!dateMatch) return null;

  const year = parseInt(dateMatch[1]!, 10);
  const month = parseInt(dateMatch[2]!, 10);
  const day = parseInt(dateMatch[3]!, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  let hour = 9;
  let minute = 0;
  if (timeStr) {
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeStr);
    if (!timeMatch) return null;
    hour = parseInt(timeMatch[1]!, 10);
    minute = parseInt(timeMatch[2]!, 10);
    if (hour > 23 || minute > 59) return null;
  }

  return { year, month, day, hour, minute };
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName("birthday")
    .setDescription("Schedule a yearly birthday card for someone")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The birthday person — they'll be mentioned when the card is posted")
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to post the card in")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("Their birthday, format YYYY-MM-DD")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Name to write on the card (defaults to their display name)")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("Time to send, 24h format HH:MM (default 09:00)")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("tz")
        .setDescription("Timezone as IANA name, e.g. Europe/Berlin (default: BIRTHDAY_TIMEZONE env var or UTC)")
        .setRequired(false)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: "This command must be used in a server.", flags: [MessageFlags.Ephemeral] });
      return;
    }

    const user = interaction.options.getUser("user", true);
    const name = (interaction.options.getString("name") ?? "").trim() || user.displayName;
    if (name.length > MAX_NAME_LENGTH) {
      await interaction.reply({
        content: `Name is too long (${name.length} characters). Max is ${MAX_NAME_LENGTH}.`,
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }
    const channel = interaction.options.getChannel("channel", true);
    const dateStr = interaction.options.getString("date", true);
    const timeStr = interaction.options.getString("time");
    const timezone = interaction.options.getString("tz") ?? process.env.BIRTHDAY_TIMEZONE ?? "UTC";

    if (!isValidTimezone(timezone)) {
      await interaction.reply({
        content: `Invalid timezone \`${timezone}\`. Use an IANA name like \`Europe/Berlin\` — see <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones>.`,
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const parsed = parseDateTime(dateStr, timeStr);
    if (!parsed) {
      await interaction.reply({
        content: "Invalid date/time. Use `YYYY-MM-DD` for the date and optional `HH:MM` (24h) for the time.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const firstOccurrence = DateTime.fromObject(parsed, { zone: timezone });
    if (!firstOccurrence.isValid) {
      await interaction.reply({
        content: `That date/time doesn't exist in ${timezone} (e.g. it falls in a DST gap). Try a different time.`,
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    // Birthdays always repeat yearly — skip to the next future occurrence
    // (e.g. a birthday that already passed this year fires next year instead).
    const sendAt = nextYearlyOccurrence(firstOccurrence.toJSDate(), timezone);

    const [existing] = await sql<{ id: number }[]>`
      SELECT id FROM birthdays WHERE guild_id = ${guildId} AND user_id = ${user.id}
    `;

    const unixSeconds = Math.floor(sendAt.getTime() / 1000);
    const when = DateTime.fromJSDate(sendAt, { zone: timezone }).toFormat("yyyy-MM-dd HH:mm");
    const utcWhen = DateTime.fromJSDate(sendAt, { zone: "UTC" }).toFormat("HH:mm");
    const details = `for ${when} (${timezone}, ${utcWhen} UTC) in ${channel}. First one <t:${unixSeconds}:R>.`;

    if (existing) {
      // This user already has a birthday in this guild — overwrite it.
      await sql`
        UPDATE birthdays
        SET channel_id = ${channel.id}, name = ${name}, send_at = ${sendAt},
            timezone = ${timezone}, created_by = ${interaction.user.id}
        WHERE id = ${existing.id}
      `;
      await interaction.reply({
        content: `A birthday entry for **${name}** (${user}) already existed — it has been overwritten. New schedule: ${details}`,
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const [row] = await sql<{ id: number }[]>`
      INSERT INTO birthdays (guild_id, channel_id, user_id, name, send_at, timezone, created_by)
      VALUES (${guildId}, ${channel.id}, ${user.id}, ${name}, ${sendAt}, ${timezone}, ${interaction.user.id})
      RETURNING id
    `;

    if (!row) throw new Error("Failed to insert birthday");

    await interaction.reply({
      content: `Birthday card for **${name}** (${user}) scheduled ${details}`,
      flags: [MessageFlags.Ephemeral],
    });
  },
} satisfies Command;

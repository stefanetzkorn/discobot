import type { Client } from "discord.js";
import { AttachmentBuilder } from "discord.js";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { DateTime } from "luxon";
import { join } from "node:path";
import { sql } from "./database.ts";

// Polls the database instead of using setTimeout, so birthdays can be scheduled
// arbitrarily far into the future without hitting Node's ~24.8 day timer cap.
const POLL_INTERVAL_MS = 60_000;

const IMAGE_PATH = join(import.meta.dir, "../assets/teto.png");

GlobalFonts.registerFromPath(join(import.meta.dir, "../assets/impact.ttf"), "Impact");

interface BirthdayRow {
  id: number;
  channel_id: string;
  user_id: string;
  name: string;
  send_at: Date;
  timezone: string | null;
}

/** IANA timezone with BIRTHDAY_TIMEZONE env fallback, then UTC. */
export function resolveTimezone(timezone: string | null | undefined): string {
  const zone = timezone ?? process.env.BIRTHDAY_TIMEZONE ?? "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return "UTC";
  }
}

/**
 * Advance a date by one year in the given timezone.
 * Keeps the same local wall-clock time (DST-correct) and maps Feb 29 → Feb 28.
 */
export function addOneYear(date: Date, timezone: string): Date {
  return DateTime.fromJSDate(date, { zone: "UTC" })
    .setZone(timezone)
    .plus({ years: 1 })
    .toUTC()
    .toJSDate();
}

/** First occurrence of the same month/day (in the given timezone) that is still in the future. */
export function nextYearlyOccurrence(date: Date, timezone: string): Date {
  let next = DateTime.fromJSDate(date, { zone: "UTC" }).setZone(timezone);
  const now = DateTime.now();
  while (next <= now) {
    next = next.plus({ years: 1 });
  }
  return next.toUTC().toJSDate();
}

async function renderBirthdayCard(): Promise<Buffer> {
  const bg = await loadImage(IMAGE_PATH);
  const canvas = createCanvas(bg.width, bg.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(bg, 0, 0);

  // "Birthday" at the bottom of the card, same style as the word-of-the-day.
  const fontSize = Math.max(48, Math.floor(bg.width / 8));
  ctx.font = `${fontSize}px Impact`;
  ctx.textAlign = "center";
  ctx.lineWidth = Math.max(4, fontSize / 8);
  ctx.strokeStyle = "black";
  ctx.strokeText("Birthday", canvas.width / 2, canvas.height - 40);
  ctx.fillStyle = "white";
  ctx.fillText("Birthday", canvas.width / 2, canvas.height - 40);

  return canvas.toBuffer("image/png");
}

async function sendBirthdayCard(client: Client, row: BirthdayRow): Promise<void> {
  try {
    const channel = await client.channels.fetch(row.channel_id);
    if (!channel?.isSendable()) {
      console.error(
        `[birthday] Channel ${row.channel_id} not found or not sendable; card for ${row.name} could not be sent`,
      );
      return;
    }

    const mention = `<@${row.user_id}>`;
    const content = `${mention} Happy Birthday ${row.name}! 🎂`;

    let files: AttachmentBuilder[] = [];
    try {
      const buffer = await renderBirthdayCard();
      files = [new AttachmentBuilder(buffer, { name: "birthday.png" })];
    } catch (error) {
      console.error(`[birthday] Failed to render card for ${row.name}:`, error);
    }

    await channel.send({ content, files });
  } catch (error) {
    console.error(`[birthday] Failed to send card for ${row.name}:`, error);
  }
}

async function fireDueBirthdays(client: Client): Promise<void> {
  const due = await sql<BirthdayRow[]>`
    SELECT id, channel_id, user_id, name, send_at, timezone
    FROM birthdays
    WHERE send_at <= NOW() AND sent = FALSE
    ORDER BY send_at
  `;

  for (const row of due) {
    await sendBirthdayCard(client, row);

    // Advance to the next year even if the send failed, so we don't retry the
    // same birthday on every poll tick. Keep the same local wall-clock time.
    await sql`
      UPDATE birthdays
      SET send_at = ${addOneYear(new Date(row.send_at), resolveTimezone(row.timezone))}
      WHERE id = ${row.id}
    `;
  }
}

export function startBirthdayScheduler(client: Client): void {
  // Fire anything already due immediately, then poll every minute.
  fireDueBirthdays(client).catch((error) => console.error("[birthday] Poll error:", error));
  setInterval(() => {
    fireDueBirthdays(client).catch((error) => console.error("[birthday] Poll error:", error));
  }, POLL_INTERVAL_MS);
}

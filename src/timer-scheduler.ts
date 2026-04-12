import type { Client } from "discord.js";
import { sql } from "./database.ts";

async function fireTimer(client: Client, timerId: number, userId: string, name: string): Promise<void> {
  try {
    const user = await client.users.fetch(userId);
    await user.send(`Your timer **${name}** has finished!`);
    await sql`UPDATE timers SET fired = TRUE WHERE id = ${timerId}`;
  } catch (error) {
    console.error(`[timer] Failed to notify user ${userId}:`, error);
  }
}

export function scheduleTimer(
  client: Client,
  timerId: number,
  userId: string,
  name: string,
  expiresAt: Date,
): void {
  const delay = expiresAt.getTime() - Date.now();

  if (delay <= 0) {
    // Timer already expired (e.g. bot was offline) — fire immediately.
    fireTimer(client, timerId, userId, name);
  } else {
    setTimeout(() => fireTimer(client, timerId, userId, name), delay);
  }
}

export async function loadPendingTimers(client: Client): Promise<void> {
  const timers = await sql<{ id: number; user_id: string; name: string; expires_at: Date }[]>`
    SELECT id, user_id, name, expires_at FROM timers WHERE fired = FALSE
  `;

  for (const timer of timers) {
    scheduleTimer(client, timer.id, timer.user_id, timer.name, new Date(timer.expires_at));
  }

  if (timers.length > 0) {
    console.log(`Scheduled ${timers.length} pending timer(s)`);
  }
}

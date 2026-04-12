import type { Client } from "discord.js";
import type { Command } from "../types.ts";
import { deployCommands } from "../deploy-commands.ts";
import { sql } from "../database.ts";
import { loadPendingTimers } from "../timer-scheduler.ts";

export function registerReadyEvent(client: Client, commands: Map<string, Command>): void {
  client.once("clientReady", async (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);

    // Close all sessions that were left open because the bot went offline.
    // Without this, COALESCE(left_at, NOW()) would keep counting stale sessions.
    await sql`UPDATE voice_sessions SET left_at = NOW() WHERE left_at IS NULL`;

    // Re-open sessions for anyone already in a voice channel right now.
    // voiceStateUpdate won't fire for them since their state didn't change.
    for (const guild of c.guilds.cache.values()) {
      for (const state of guild.voiceStates.cache.values()) {
        if (state.channelId && state.member && !state.member.user.bot) {
          await sql`
            INSERT INTO voice_sessions (guild_id, user_id, channel_id)
            VALUES (${guild.id}, ${state.id}, ${state.channelId})
          `;
        }
      }
    }

    await loadPendingTimers(c);

    for (const guild of c.guilds.cache.values()) {
      await deployCommands(commands, guild.id);
    }
  });
}

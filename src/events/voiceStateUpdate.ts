import type { Client } from "discord.js";
import { sql } from "../database.ts";

export function registerVoiceStateUpdate(client: Client): void {
  client.on("voiceStateUpdate", async (oldState, newState) => {
    const userId = newState.member?.user.id ?? oldState.member?.user.id;
    const guildId = newState.guild.id;

    if (!userId) return;

    const joined   = !oldState.channelId && !!newState.channelId;
    const left     = !!oldState.channelId && !newState.channelId;
    const switched = !!oldState.channelId && !!newState.channelId
                  && oldState.channelId !== newState.channelId;

    try {
      if (joined && newState.channel) {
        await sql`
          INSERT INTO voice_sessions (guild_id, user_id, channel_id)
          VALUES (${guildId}, ${userId}, ${newState.channel.id})
        `;
        console.log(`[voice] ${newState.member?.user.tag} joined #${newState.channel.name}`);
      } else if (left) {
        await sql`
          UPDATE voice_sessions
          SET left_at = NOW()
          WHERE user_id = ${userId} AND guild_id = ${guildId} AND left_at IS NULL
        `;
        console.log(`[voice] ${oldState.member?.user.tag} left #${oldState.channel?.name}`);
      } else if (switched && newState.channel) {
        await sql`
          UPDATE voice_sessions
          SET left_at = NOW()
          WHERE user_id = ${userId} AND guild_id = ${guildId} AND left_at IS NULL
        `;
        await sql`
          INSERT INTO voice_sessions (guild_id, user_id, channel_id)
          VALUES (${guildId}, ${userId}, ${newState.channel.id})
        `;
        console.log(`[voice] ${newState.member?.user.tag} switched to #${newState.channel.name}`);
      }
      // Mute/deafen events have the same channelId in both states — ignored.
    } catch (error) {
      console.error("[voice] Database error:", error);
    }
  });
}

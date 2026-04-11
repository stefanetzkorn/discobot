import type { Client } from "discord.js";
import type { Database } from "bun:sqlite";

export function registerVoiceStateUpdate(client: Client, db: Database): void {
  const insertSession = db.prepare(`
    INSERT INTO voice_sessions (guild_id, user_id, channel_id, channel_name, joined_at)
    VALUES ($guild_id, $user_id, $channel_id, $channel_name, unixepoch())
  `);

  const closeSession = db.prepare(`
    UPDATE voice_sessions
    SET left_at = unixepoch()
    WHERE user_id = $user_id
      AND guild_id = $guild_id
      AND left_at IS NULL
  `);

  client.on("voiceStateUpdate", (oldState, newState) => {
    const userId = newState.member?.user.id ?? oldState.member?.user.id;
    const guildId = newState.guild.id;

    if (!userId) return;

    const joined   = !oldState.channelId && !!newState.channelId;
    const left     = !!oldState.channelId && !newState.channelId;
    const switched = !!oldState.channelId && !!newState.channelId
                  && oldState.channelId !== newState.channelId;

    if (joined && newState.channel) {
      insertSession.run({
        guild_id:     guildId,
        user_id:      userId,
        channel_id:   newState.channel.id,
        channel_name: newState.channel.name,
      });
      console.log(`[voice] ${newState.member?.user.tag} joined #${newState.channel.name}`);
    } else if (left) {
      closeSession.run({ user_id: userId, guild_id: guildId });
      console.log(`[voice] ${oldState.member?.user.tag} left #${oldState.channel?.name}`);
    } else if (switched && newState.channel) {
      closeSession.run({ user_id: userId, guild_id: guildId });
      insertSession.run({
        guild_id:     guildId,
        user_id:      userId,
        channel_id:   newState.channel.id,
        channel_name: newState.channel.name,
      });
      console.log(`[voice] ${newState.member?.user.tag} switched to #${newState.channel.name}`);
    }
    // Mute/deafen events have the same channelId in both states — ignored.
  });
}

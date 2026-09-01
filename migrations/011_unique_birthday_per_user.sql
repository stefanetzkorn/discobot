-- Remove duplicate birthday entries, keeping the earliest row per user/guild,
-- so the unique constraint below can be applied.
DELETE FROM birthdays a
USING birthdays b
WHERE a.guild_id = b.guild_id
  AND a.user_id = b.user_id
  AND a.id > b.id;

ALTER TABLE birthdays
  ADD CONSTRAINT birthdays_guild_user_unique UNIQUE (guild_id, user_id);

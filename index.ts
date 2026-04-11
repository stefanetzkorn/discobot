import { join } from "node:path";
import { createClient } from "./src/client.ts";
import { createDatabase } from "./src/database.ts";
import { loadCommands } from "./src/loader.ts";
import { registerReadyEvent } from "./src/events/ready.ts";
import { registerGuildCreate } from "./src/events/guildCreate.ts";
import { registerInteractionCreate } from "./src/events/interactionCreate.ts";
import { registerVoiceStateUpdate } from "./src/events/voiceStateUpdate.ts";

const COMMANDS_DIR = join(import.meta.dir, "src", "commands");

const db = createDatabase("data/bot.db");
const commands = await loadCommands(COMMANDS_DIR);

const client = createClient();
registerReadyEvent(client, commands);
registerGuildCreate(client, commands);
registerInteractionCreate(client, commands, db);
registerVoiceStateUpdate(client, db);

await client.login(process.env.DISCORD_TOKEN);

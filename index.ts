import { join } from "node:path";
import { createClient } from "./src/client.ts";
import { runMigrations } from "./src/migrate.ts";
import { loadCommands } from "./src/loader.ts";
import { registerReadyEvent } from "./src/events/ready.ts";
import { registerGuildCreate } from "./src/events/guildCreate.ts";
import { registerInteractionCreate } from "./src/events/interactionCreate.ts";
import { registerVoiceStateUpdate } from "./src/events/voiceStateUpdate.ts";

const COMMANDS_DIR = join(import.meta.dir, "src", "commands");

await runMigrations();
const commands = await loadCommands(COMMANDS_DIR);

const client = createClient();
registerReadyEvent(client, commands);
registerGuildCreate(client, commands);
registerInteractionCreate(client, commands);
registerVoiceStateUpdate(client);

await client.login(process.env.DISCORD_TOKEN);

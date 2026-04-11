import type { Client } from "discord.js";

export function registerReadyEvent(client: Client): void {
  client.once("clientReady", (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
  });
}

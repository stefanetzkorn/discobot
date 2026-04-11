import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import type { Database } from "bun:sqlite";

export interface Command {
  // The union is needed because adding options (e.g. .addUserOption()) narrows
  // the return type away from SlashCommandBuilder.
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction, db: Database) => Promise<void>;
}

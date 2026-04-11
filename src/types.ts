import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";

export interface Command {
  // The union is needed because adding options (e.g. .addUserOption()) narrows
  // the return type away from SlashCommandBuilder.
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

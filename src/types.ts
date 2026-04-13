import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

export interface Command {
  // The union is needed because adding options (e.g. .addUserOption()) or
  // subcommands narrows the return type away from SlashCommandBuilder.
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  handleButton?: (interaction: ButtonInteraction) => Promise<void>;
}

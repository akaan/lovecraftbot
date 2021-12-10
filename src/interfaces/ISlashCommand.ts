import {
  ChatInputApplicationCommandData,
  CommandInteraction,
} from "discord.js";

export interface ISlashCommandResult {
  message: string;
  [key: string]: unknown;
}

export interface ISlashCommand extends ChatInputApplicationCommandData {
  isAdmin: boolean;
  execute(interaction: CommandInteraction): Promise<ISlashCommandResult>;
}

export type SlashCommandConstructor<T = ISlashCommand> = new () => T;

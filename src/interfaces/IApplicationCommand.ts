import {
  ChatInputApplicationCommandData,
  CommandInteraction,
} from "discord.js";

export interface IApplicationCommandResult {
  message: string;
  [key: string]: unknown;
}

export interface IApplicationCommand extends ChatInputApplicationCommandData {
  isGuildCommand: boolean;
  execute(interaction: CommandInteraction): Promise<IApplicationCommandResult>;
}

export type ApplicationCommandConstructor<T = IApplicationCommand> =
  new () => T;

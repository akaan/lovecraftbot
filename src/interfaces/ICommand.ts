import * as Discord from "discord.js";

export interface ICommandResult {
  resultString?: string;
  result?: unknown;
}

export interface ICommandArgs {
  debug?: boolean;
  cmd: string;
  args: string;
  message: Discord.Message;
  user: Discord.User;
}

// commands are created once, and then run multiple times as needed.
export interface ICommand {
  help: string;
  aliases?: string[];
  admin?: boolean;

  // run when the aliases are matched, and if the function is added to the command
  execute?(args: ICommandArgs): Promise<ICommandResult>;

  // run when a message happens, if the function is added to the command
  onMessage?(message: Discord.Message): void;

  // run when an emoji is added to a message, if the function is added to the command
  onEmojiAdd?(
    reaction: Discord.MessageReaction,
    user: Discord.User | Discord.PartialUser
  ): void;

  // run when an emoji is removed from a message, if the function is added to the command
  onEmojiRemove?(
    reaction: Discord.MessageReaction,
    user: Discord.User | Discord.PartialUser
  ): void;
}

export type CommandConstructor<T = ICommand> = new () => T;

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";

export class EchoCommand implements ICommand {
  help = "Echo your message right back at'cha!";

  aliases = ["echo"];

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message, args } = cmdArgs;
    await message.reply(args);

    return { resultString: args };
  }
}

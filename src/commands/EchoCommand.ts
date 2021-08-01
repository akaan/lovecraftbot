import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";

export class EchoCommand implements ICommand {
  aliases = ["echo"];
  help = "Te renvoie ton propre message !";

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message, args } = cmdArgs;
    await message.reply(args);
    return { resultString: `[EchoCommand] echo "${args}""` };
  }
}

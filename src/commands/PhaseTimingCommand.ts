import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";

export class PhaseTimingCommand implements ICommand {
  aliases = ["p"];
  help = "Affiche le timing des phases de jeu";

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message } = cmdArgs;

    await message.reply({ files: ["assets/phase.jpg"] });
    return {
      resultString: "PhaseTimingCommand: Timing des phases envoyé",
    };
  }
}

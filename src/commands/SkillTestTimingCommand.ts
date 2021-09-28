import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";

export class SkillTestTimingCommand implements ICommand {
  aliases = ["t"];
  help = "Affiche le timing d'un test de compétence";

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message } = cmdArgs;

    await message.reply({ files: ["assets/timing.jpg"] });
    return {
      resultString: "SkillTestTimingCommand: Timing envoyé",
    };
  }
}

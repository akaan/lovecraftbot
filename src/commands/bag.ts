import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { ChaosBagService } from "../services/chaosbag";
import { Inject } from "typescript-ioc";

export class BagCommand implements ICommand {
  help = "Tire un jeton chaos (Nuit de la Zélatrice Standard)";
  aliases = ["bag"];

  @Inject chaosBagService: ChaosBagService;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message } = cmdArgs;
    await message.channel.send(this.chaosBagService.pullToken());

    return { resultString: "BagCommand: Jeton envoyé" };
  }
}

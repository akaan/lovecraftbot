import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { ChaosBagService } from "../services/ChaosBagService";
import { Inject } from "typescript-ioc";

export class BagCommand implements ICommand {
  aliases = ["bag"];
  help = "Tire un jeton chaos (Nuit de la Zélatrice Standard)";

  @Inject private chaosBagService!: ChaosBagService;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message } = cmdArgs;
    await message.channel.send(this.chaosBagService.pullToken() || "??");
    return { resultString: "BagCommand: Jeton envoyé" };
  }
}

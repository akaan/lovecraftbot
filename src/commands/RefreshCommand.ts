import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { CardService } from "../services/CardService";
import { Inject } from "typescript-ioc";

export class RefreshCommand implements ICommand {
  aliases = ["refresh"];
  help = "Recharge les toutes dernières cartes depuis ArkhamDB";

  constructor(@Inject private cardService: CardService) {}

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message } = cmdArgs;
    await this.cardService.downloadLatestCardDb();

    await message.reply("C'est bon, les cartes ont été rechargées !");
    return {
      resultString: "RefreshCommand: Cartes rechargées depuis ArkhamDB",
    };
  }
}

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { CardService } from "../services/card";
import { Inject } from "typescript-ioc";

export class RefreshCommand implements ICommand {
  aliases = ["refresh"];
  help = "Recharge les toutes dernières cartes depuis ArkhamDB";

  @Inject cardService?: CardService;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message } = cmdArgs;

    if (!this.cardService) {
      await message.reply("Oups, impossible de recharger les cartes.");
      return { resultString: `[RefreshCommand] ResourcesService absent` };
    }

    await this.cardService.downloadLatestCardDb();

    await message.reply("C'est bon, les cartes ont été rechargées !");
    return {
      resultString: "RefreshCommand: Cartes rechargées depuis ArkhamDB",
    };
  }
}

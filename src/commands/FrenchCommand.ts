import { Inject } from "typescript-ioc";

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { CardService } from "../services/CardService";

export class FrenchCommand implements ICommand {
  aliases = ["f"];
  help = `Affiche le nom français de la carte indiquée (recherche exacte)`;

  @Inject private cardService!: CardService;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message, args } = cmdArgs;
    const maybeFrenchName = this.cardService.getFrenchCardName(args);

    if (maybeFrenchName) {
      await message.reply(`${maybeFrenchName}`);
      return {
        resultString: `[FrenchCommand] Nom français envoyé pour "${args}"`,
      };
    } else {
      await message.reply(
        `Désolé, je ne trouve pas de nom français pour "${args}`
      );
      return {
        resultString: `[FrenchCommand] Pas de nom français trouvé pour "${args}"`,
      };
    }
  }
}

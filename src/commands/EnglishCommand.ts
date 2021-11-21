import { Inject } from "typescript-ioc";

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { CardService } from "../services/CardService";

export class EnglishCommand implements ICommand {
  aliases = ["e"];
  help = `Affiche le nom anglais de la carte indiquée (recherche exacte)`;

  @Inject private cardService!: CardService;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message, args } = cmdArgs;
    const maybeFrenchName = this.cardService.getEnglishCardName(args);

    if (maybeFrenchName) {
      await message.reply(`${maybeFrenchName}`);
      return {
        resultString: `[EnglishCommand] Nom anglais envoyé pour "${args}"`,
      };
    } else {
      await message.reply(
        `Désolé, je ne trouve pas de nom anglais pour "${args}`
      );
      return {
        resultString: `[EnglishCommand] Pas de nom anglais trouvé pour "${args}"`,
      };
    }
  }
}

import { Inject } from "typescript-ioc";

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { CardService } from "../services/card";

export class CardCommand implements ICommand {
  help = "Affiche la carte correspondant au numéro";
  aliases = ["!", "c", "card", "carte"];

  @Inject private cardService: CardService;
  private CARD_ID_REGEX = /\d{5}/;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message, args } = cmdArgs;

    const maybeCardId = this.CARD_ID_REGEX.exec(args);
    if (maybeCardId) {
      const cardId = maybeCardId[0];
      const imageUrl = await this.cardService.getCardImageLink(cardId);
      if (imageUrl) {
        await message.reply(imageUrl);
        return { resultString: "card: image envoyée" };
      } else {
        await message.reply(
          `Je n'ai pas trouvé d'image pour la carte ${cardId}`
        );
        return { resultString: "card: image non trouvée" };
      }
    } else {
      await message.reply("Je n'ai pas compris");
      return { resultString: "card: pas d'ID de carte précisé" };
    }
  }
}

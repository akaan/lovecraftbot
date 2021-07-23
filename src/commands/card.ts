import * as Discord from "discord.js";
import { Inject } from "typescript-ioc";

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { ArkhamDBCard, CardService } from "../services/card";

const ERROR_NO_CARD_SERVICE = {
  resultString: `[CardCommand] CardService asbent`,
};

export class CardCommand implements ICommand {
  aliases = ["!", "c", "card", "carte"];
  help = "Affiche la carte correspondant au numéro";

  @Inject private cardService?: CardService;
  private CARD_CODE_REGEX = /\d{5}$/;
  private CARD_AND_XP_REGEX = /(\D*)(?:\s(\d))?$/;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    if (!this.cardService) {
      return ERROR_NO_CARD_SERVICE;
    }

    const { message, args } = cmdArgs;

    const maybeCardCode = this.CARD_CODE_REGEX.exec(args);
    if (maybeCardCode) {
      // Recherche par code de carte
      const cardCode = maybeCardCode[0];
      return this.sendCardWithCode(message, cardCode);
    }

    const matches = this.CARD_AND_XP_REGEX.exec(args);
    if (!matches) {
      await message.reply("je n'ai pas compris la demande.");
      return {
        resultString: `[CardCommand] Impossible d'interpréter "${args}"`,
      };
    }

    // Recherche par titre de carte
    const [, searchString, maybeXpAsString] = matches;
    const foundCards = this.cardService.getCards(searchString.trim());
    //.filter((c) => c.faction_code !== "mythos");

    if (foundCards.length === 0) {
      await message.reply("désolé, le mystère de cette carte reste entier.");
      return {
        resultString: `[CardCommand] Aucune carte correspondant à la recherche "${searchString.trim()}"`,
      };
    }

    if (maybeXpAsString && maybeXpAsString !== "0") {
      // La première carte avec le niveau d'XP précisé
      const maybeCardWithGivenXp = foundCards.find(
        (c) => c.xp === parseInt(maybeXpAsString, 10)
      );
      if (maybeCardWithGivenXp) {
        return this.sendCards(message, [maybeCardWithGivenXp]);
      } else {
        await message.reply(
          `je n'ai pas trouvé de carte de niveau ${maybeXpAsString} correspondant.`
        );
        return {
          resultString: `[CardCommand] Aucune carte d'XP ${maybeXpAsString} correspondant à "${searchString}"`,
        };
      }
    }

    if (maybeXpAsString && maybeXpAsString === "0") {
      // Tous les niveaux de la première carte trouvée
      const allCards = foundCards.filter((c) => c.name === foundCards[0].name);
      return this.sendCards(message, allCards);
    }

    // La première des cartes trouvées pour ce titre
    return this.sendCards(message, [foundCards[0]]);
  }

  private async sendCardWithCode(
    message: Discord.Message,
    code: string
  ): Promise<ICommandResult> {
    if (!this.cardService) {
      return ERROR_NO_CARD_SERVICE;
    }

    const maybeCardByCode = this.cardService.getCardByCode(code);
    if (maybeCardByCode) {
      const cardByCode = maybeCardByCode;
      await message.reply(await this.cardService.createEmbed(cardByCode));
    }

    return {
      resultString: `[CardCommand] Aucune carte correspondant au code "${code}"`,
    };
  }

  private async sendCards(
    message: Discord.Message,
    cards: ArkhamDBCard[]
  ): Promise<ICommandResult> {
    if (!this.cardService) {
      return ERROR_NO_CARD_SERVICE;
    }
    const surelyCardService = this.cardService;

    const embeds = await Promise.all(
      cards.map((card) => surelyCardService.createEmbed(card))
    );
    await Promise.all(embeds.map((embed) => message.reply(embed)));
    return {
      resultString: `[CardCommand] ${cards.length} carte(s) envoyée's`,
    };
  }
}

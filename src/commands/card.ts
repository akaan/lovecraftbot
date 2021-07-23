import * as Discord from "discord.js";
import { Inject } from "typescript-ioc";

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { CardService } from "../services/card";

export class CardCommand implements ICommand {
  aliases = ["!", "c", "card", "carte"];
  help = "Affiche la carte correspondant au numéro";

  @Inject private cardService?: CardService;
  private CARD_CODE_REGEX = /\d{5}$/;
  private CARD_AND_XP_REGEX = /(\D*)(?:\s(\d))?$/;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    if (!this.cardService) {
      return { resultString: `[CardCommand] CardService asbent` };
    }

    const { message, args } = cmdArgs;

    const maybeCardCode = this.CARD_CODE_REGEX.exec(args);
    if (maybeCardCode) {
      // Recherche par code de carte
      await this.sendCardWithCode(message, maybeCardCode[0]);
      return {
        resultString: `[CardCommand] Par code ${maybeCardCode[0]} : image envoyée.`,
      };
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
    const foundCards = this.cardService
      .getCards(searchString.trim())
      .filter((c) => c.faction !== "mythos");

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
        await this.sendCardWithCode(message, maybeCardWithGivenXp.code);
        return {
          resultString: `[CardCommand] Par recherche "${searchString.trim()}" et XP = "${maybeXpAsString}": image envoyée.`,
        };
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
      await Promise.all(
        allCards.map((c) => this.sendCardWithCode(message, c.code))
      );
      return {
        resultString: `[CardCommand] Par recherche "${searchString.trim()}", tout niveau d'XP : images envoyées.`,
      };
    }

    // La première des cartes trouvées pour ce titre
    if (await this.sendCardWithCode(message, foundCards[0].code)) {
      return {
        resultString: `[CardCommand] Par recherche "${searchString.trim()}" : image envoyée.`,
      };
    }

    await message.reply("désolé, le mystère de cette carte reste entier.");
    return {
      resultString: `[CardCommand] Aucune carte correspondant à "${args}"`,
    };
  }

  private async sendCardWithCode(
    message: Discord.Message,
    code: string
  ): Promise<boolean> {
    if (!this.cardService) {
      return false;
    }

    const maybeCardWithCode = this.cardService.getCardByCode(code);
    if (maybeCardWithCode) {
      const cardWithCode = maybeCardWithCode;
      const maybeFrenchCardImageLink = await this.cardService.getFrenchCardImage(
        cardWithCode.code
      );

      if (maybeFrenchCardImageLink) {
        const frenchCardImageLink = maybeFrenchCardImageLink;
        await message.reply(frenchCardImageLink);
        return true;
      }

      if (cardWithCode.imagesrc) {
        const maybeCardImageLink = await this.cardService.getCardImage(
          cardWithCode
        );
        if (maybeCardImageLink) {
          const cardImageLink = maybeCardImageLink;
          await message.reply(cardImageLink);
          return true;
        }
      }
    }

    await message.reply("Pas d'image disponible pour cette carte.");
    return false;
  }
}

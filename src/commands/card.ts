import * as Discord from "discord.js";
import { Inject } from "typescript-ioc";

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { CardService } from "../services/card";

export class CardCommand implements ICommand {
  help = "Affiche la carte correspondant au numéro";
  aliases = ["!", "c", "card", "carte"];

  @Inject private cardService: CardService;
  private CARD_ID_REGEX = /\d{5}$/;
  private CARD_AND_XP_REGEX = /(\D*)(?:\s(\d))?$/;

  private async sendSingleCardImageLink(
    message: Discord.Message,
    cardId: string
  ): Promise<ICommandResult> {
    const imageUrl = await this.cardService.getCardImageLink(cardId);
    if (imageUrl) {
      await message.reply(imageUrl);
      return {
        resultString: `CardCommand: image envoyée.`,
      };
    } else {
      await message.reply(`Je n'ai pas trouvé d'image pour la carte ${cardId}`);
      return {
        resultString: `CardCommand: image non trouvée pour l'ID ${cardId}`,
      };
    }
  }

  private async sendCardImageLinks(
    message: Discord.Message,
    cardIds: string[]
  ): Promise<ICommandResult> {
    const maybeLinks = await Promise.all(
      cardIds.map((id) => this.cardService.getCardImageLink(id))
    );
    const links = maybeLinks.filter((l) => l !== undefined);
    if (links.length > 0) {
      await Promise.all(links.map((l) => message.reply(l)));
      return { resultString: `CardCommand: images envoyées` };
    } else {
      await message.reply(`je n'ai trouvé aucune image pour ces cartes.`);
      return {
        resultString: `CardCommand: aucune image trouvée pour les ID ${cardIds.join(
          ", "
        )}`,
      };
    }
  }

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message, args } = cmdArgs;

    const maybeCardId = this.CARD_ID_REGEX.exec(args);
    if (maybeCardId) {
      // Recherche par ID de carte
      return this.sendSingleCardImageLink(message, maybeCardId[0]);
    }

    // Recherche par titre de carte
    const [, searchString, maybeXpAsString] = this.CARD_AND_XP_REGEX.exec(args);
    const cardsForTitle = await this.cardService.getCardsForTitle(
      searchString.trim()
    );

    if (cardsForTitle.length === 0) {
      await message.reply("désolé, le mystère de cette carte reste entier.");
      return {
        resultString: `CardCommand: Aucune carte correspondant à "${searchString}"`,
      };
    }

    if (maybeXpAsString && maybeXpAsString !== "0") {
      // La première carte avec le niveau d'XP précisé
      const maybeCardWithGivenXp = cardsForTitle.find(
        (c) => c.xp === parseInt(maybeXpAsString, 10)
      );
      if (maybeCardWithGivenXp) {
        return this.sendSingleCardImageLink(message, maybeCardWithGivenXp.id);
      } else {
        await message.reply(
          `je n'ai pas trouvé de carte de niveau ${maybeXpAsString} correspondant.`
        );
        return {
          resultString: `CardCommand: Aucune carte de niveau ${maybeXpAsString} correspondant à "${searchString}"`,
        };
      }
    }

    if (maybeXpAsString && maybeXpAsString === "0") {
      // Tous les niveaux de la première carte trouvée
      const allCards = cardsForTitle.filter(
        (c) => c.title === cardsForTitle[0].title
      );
      return this.sendCardImageLinks(
        message,
        allCards.map((c) => c.id)
      );
    }

    // La première des cartes trouvées pour ce titre
    return this.sendSingleCardImageLink(message, cardsForTitle[0].id);
  }
}

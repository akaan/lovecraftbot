import * as Discord from "discord.js";
import { Inject } from "typescript-ioc";

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { ArkhamDBCard, CardService } from "../services/card";

const ERROR_NO_CARD_SERVICE = {
  resultString: `[CardCommand] CardService asbent`,
};

export class CardCommand implements ICommand {
  aliases = ["!", "c", "card", "carte", "d", "dos"];
  help = `Pour l'affichage de carte(s).

  Usage: \`cmd recherche xp\`
  - \`xp\` peut être omis
  - \`recherche\` peut être un code de carte ou du texte
  - si \`xp\` est fourni alors recherche d'une carte avec ce niveau d'XP
  - si \`xp\`= 0 alors envoie de tous les niveaux de la carte trouvée
  - les commandes \`d\` et \`dos\` envoient le dos de la carte s'il existe
  - les commandes \`!\`, \`c\` et \`d\` n'envoient que l'image de la carte
  - les commandes \`card\`, \`carte\` et \`dos\` envoient une description complète de la carte`;

  @Inject private cardService?: CardService;
  private CARD_CODE_REGEX = /\d{5}$/;
  private CARD_AND_XP_REGEX = /(\D*)(?:\s(\d))?$/;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    if (!this.cardService) {
      return ERROR_NO_CARD_SERVICE;
    }

    const { cmd, message, args } = cmdArgs;
    const extended = ["card", "carte", "dos"].includes(cmd);
    const back = ["d", "dos"].includes(cmd);

    const maybeCardCode = this.CARD_CODE_REGEX.exec(args);
    if (maybeCardCode) {
      // Recherche par code de carte
      const cardCode = maybeCardCode[0];
      return this.sendCardWithCode(message, cardCode, back, extended);
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

    if (back) {
      if (this.cardService.hasBack(foundCards[0])) {
        return this.sendCardBack(message, foundCards[0], extended);
      } else {
        await message.reply(
          `désolé, la carte ${foundCards[0].name} n'a pas de dos.`
        );
        return {
          resultString: `[CardCommand] Pas de dos pour la carte demandée`,
        };
      }
    }

    if (maybeXpAsString && maybeXpAsString !== "0") {
      // La première carte avec le niveau d'XP précisé
      const maybeCardWithGivenXp = foundCards.find(
        (c) => c.xp === parseInt(maybeXpAsString, 10)
      );
      if (maybeCardWithGivenXp) {
        return this.sendCards(message, [maybeCardWithGivenXp], extended);
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
      return this.sendCards(message, allCards, extended);
    }

    // La première des cartes trouvées pour ce titre
    return this.sendCards(message, [foundCards[0]], extended);
  }

  private async sendCardWithCode(
    message: Discord.Message,
    code: string,
    back = false,
    extended = false
  ): Promise<ICommandResult> {
    if (!this.cardService) {
      return ERROR_NO_CARD_SERVICE;
    }

    const maybeCardByCode = this.cardService.getCardByCode(code);
    if (maybeCardByCode) {
      const cardByCode = maybeCardByCode;

      if (back && !this.cardService.hasBack(cardByCode)) {
        await message.reply("désolé, cette carte n'a pas de dos.");
        return {
          resultString: `[CardCommand] La carte de code "${code}" n'a pas de dos.`,
        };
      }

      await message.reply(
        await this.cardService.createEmbed(cardByCode, back, extended)
      );

      return {
        resultString: `[CardCommand] Carte envoyée`,
      };
    }

    return {
      resultString: `[CardCommand] Aucune carte correspondant au code "${code}"`,
    };
  }

  private async sendCardBack(
    message: Discord.Message,
    card: ArkhamDBCard,
    extended = false
  ): Promise<ICommandResult> {
    if (!this.cardService) {
      return ERROR_NO_CARD_SERVICE;
    }

    const embed = await this.cardService.createEmbed(card, true, extended);
    await message.reply(embed);
    return {
      resultString: `[CardCommand] Dos de carte envoyée`,
    };
  }

  private async sendCards(
    message: Discord.Message,
    cards: ArkhamDBCard[],
    extended = false
  ): Promise<ICommandResult> {
    if (!this.cardService) {
      return ERROR_NO_CARD_SERVICE;
    }
    const surelyCardService = this.cardService;

    const embeds = await Promise.all(
      cards.map((card) => surelyCardService.createEmbed(card, false, extended))
    );
    await Promise.all(embeds.map((embed) => message.reply(embed)));
    return {
      resultString: `[CardCommand] ${cards.length} carte(s) envoyée's`,
    };
  }
}

import { Inject } from "typescript-ioc";

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import {
  ArkhamDBCard,
  CardPool,
  CardService,
  SearchType,
} from "../services/card";
import { DiscordMenu } from "../utils/DiscordMenu";

const ERROR_NO_CARD_SERVICE = {
  resultString: `[CardCommand] CardService asbent`,
};

interface SearchOptions {
  cardPool: CardPool;
  xp: "none" | "all" | number;
  extended: boolean;
  back: boolean;
  searchType: SearchType;
  searchString: string;
}

export class CardCommand implements ICommand {
  aliases = [
    "!",
    "c",
    "carte",
    "d",
    "dos",
    "r",
    "rencontre",
    "rd",
    "rencontred",
  ];
  help = `Pour l'affichage de carte(s).

  Usage: \`cmd recherche xp\`
  - \`xp\` peut être omis
  - \`recherche\` peut être un code de carte ou du texte
  - si \`xp\` est fourni alors recherche d'une carte avec ce niveau d'XP
  - si \`xp\`= 0 alors envoie de tous les niveaux de la carte trouvée

  La distinction entre les commandes \`cmd\` est la suivante :
  - \`!\` ou \`c\`: juste l'image de la carte
  - \`carte\`: carte joueur avec description
  - \`d\`: juste l'image du dos de la carte joueur
  - \`dos\`: dos de carte joueur avec description
  - \`r\`: juste l'image de la carte rencontre
  - \`rencontre\`: carte rencontre avec description
  - \`rd\`: juste l'image du dos de la carte rencontre
  - \`rencontred\`: dos de carte rencontre avec description`;

  @Inject private cardService?: CardService;
  private CARD_CODE_REGEX = /\d{5}$/;
  private CARD_AND_XP_REGEX = /(\D*)(?:\s(\d))?$/;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    if (!this.cardService) {
      return ERROR_NO_CARD_SERVICE;
    }
    const cardService = this.cardService;

    const { cmd, message, args } = cmdArgs;
    const searchOptions = this.getSearchOptions(cmd, args);

    let foundCards: ArkhamDBCard[] = [];

    if (searchOptions) {
      foundCards = this.cardService.getCards({
        searchString: searchOptions.searchString,
        searchType: searchOptions.searchType,
        searchCardPool: searchOptions.cardPool,
        includeSameNameCards: searchOptions.xp !== "none",
      });

      if (typeof searchOptions.xp === "number") {
        foundCards = foundCards.filter((card) => card.xp === searchOptions.xp);
      }
    } else {
      await message.reply("je n'ai pas compris la demande.");
      return {
        resultString: `[CardCommand] Impossible d'interpréter "${cmd}" et "${args}"`,
      };
    }

    if (foundCards.length > 0) {
      const embeds = await Promise.all(
        foundCards.map((card) =>
          cardService.createEmbed(card, {
            back: searchOptions.back,
            extended: searchOptions.extended,
          })
        )
      );
      if (embeds.length > 1) {
        const menu = new DiscordMenu(embeds);
        await menu.replyTo(message);
        return {
          resultString: `[CardCommand] Cartes envoyées pour la recherche ${cmd} ${args}`,
        };
      } else {
        await message.reply(embeds[0]);
        return {
          resultString: `[CardCommand] Carte envoyée pour la recherche ${cmd} ${args}`,
        };
      }
    } else {
      await message.reply("désolé, le mystère de cette carte reste entier.");
      return {
        resultString: `[CardCommand] Aucune carte correspondant à la recherche ${cmd} ${args}`,
      };
    }
  }

  private getSearchOptions(
    cmd: string,
    args: string
  ): SearchOptions | undefined {
    const extended = [
      "card",
      "carte",
      "dos",
      "rencontre",
      "rencontred",
    ].includes(cmd);
    const back = ["d", "dos", "rd", "rencontred"].includes(cmd);
    const cardPool = ["r", "rencontre", "rd", "rencontred"].includes(cmd)
      ? CardPool.ENCOUNTER
      : CardPool.PLAYER;
    const searchType = this.CARD_CODE_REGEX.test(args)
      ? SearchType.BY_CODE
      : SearchType.BY_TITLE;

    if (searchType == SearchType.BY_CODE) {
      const cardCodeMatches = this.CARD_CODE_REGEX.exec(args);
      if (cardCodeMatches) {
        return {
          back,
          cardPool,
          extended,
          searchType,
          searchString: cardCodeMatches[0],
          xp: "none",
        };
      }
    } else {
      const titleAndXpMatches = this.CARD_AND_XP_REGEX.exec(args);
      if (titleAndXpMatches) {
        const [, title, xpAsString] = titleAndXpMatches;
        const parsedXp = parseInt(xpAsString, 10);
        const xp = isNaN(parsedXp) ? "none" : parsedXp;
        return {
          cardPool,
          extended,
          back,
          searchType,
          xp: xp === 0 ? "all" : xp,
          searchString: title.trim(),
        };
      }
    }
  }
}

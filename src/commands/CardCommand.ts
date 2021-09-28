import { Inject } from "typescript-ioc";

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { ArkhamDBCard, CardService, SearchType } from "../services/CardService";
import { DiscordMenu } from "../utils/DiscordMenu";

interface SearchOptions {
  xp: "none" | "all" | number;
  extended: boolean;
  back: boolean;
  searchType: SearchType;
  searchString: string;
}

export class CardCommand implements ICommand {
  aliases = ["!", "c", "carte", "d", "dos"];
  help = `Pour l'affichage de carte(s).

  Usage: \`cmd recherche xp\`
  - \`xp\` peut être omis
  - \`recherche\` peut être un code de carte ou du texte
  - si \`xp\` est fourni alors recherche d'une carte avec ce niveau d'XP
  - si \`xp\`= 0 alors envoie de tous les niveaux de la carte trouvée

  La distinction entre les commandes \`cmd\` est la suivante :
  - \`!\` ou \`c\`: juste l'image de la carte
  - \`carte\`: carte avec description
  - \`d\`: juste l'image du dos de la carte
  - \`dos\`: dos de carte avec description`;

  private CARD_CODE_REGEX = /(\d{5})(b?)$/;
  private CARD_AND_XP_REGEX = /(\D*)(?:\s(\d))?$/;

  @Inject private cardService!: CardService;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { cmd, message, args } = cmdArgs;
    const searchOptions = this.getSearchOptions(cmd, args);

    let foundCards: ArkhamDBCard[] = [];

    if (searchOptions) {
      foundCards = this.cardService.getCards({
        searchString: searchOptions.searchString,
        searchType: searchOptions.searchType,
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
          this.cardService.createEmbed(card, {
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
    const extended = ["carte", "dos"].includes(cmd);
    const back = ["d", "dos"].includes(cmd);
    const searchType = this.CARD_CODE_REGEX.test(args)
      ? SearchType.BY_CODE
      : SearchType.BY_TITLE;

    if (searchType == SearchType.BY_CODE) {
      const cardCodeMatches = this.CARD_CODE_REGEX.exec(args);
      if (cardCodeMatches) {
        const [, cardCode, backFlag] = cardCodeMatches;
        return {
          back: back || backFlag !== "",
          extended,
          searchType,
          searchString: cardCode,
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

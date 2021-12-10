import { CommandInteraction } from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import { ISlashCommand, ISlashCommandResult } from "../interfaces";
import { ArkhamDBCard, CardService, SearchType } from "../services/CardService";
import { DiscordMenu } from "../utils/DiscordMenu";

interface SearchOptions {
  xp: "none" | "all" | number;
  extended: boolean;
  back: boolean;
  searchType: SearchType;
  searchString: string;
}

export class CardCommand implements ISlashCommand {
  @Inject private cardService!: CardService;

  isAdmin = false;
  name = "carte";
  description = `Pour l'affichage de carte(s)`;
  options = [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "recherche",
      description:
        "Code de la carte ou texte à chercher dans le titre de la carte",
      required: true,
    },
    {
      type: ApplicationCommandOptionTypes.INTEGER,
      name: "xp",
      description:
        "Le niveau d'XP de la carte recherchée ou '0' pour envoyer tous les niveaux de la carte",
      required: false,
    },
    {
      type: ApplicationCommandOptionTypes.BOOLEAN,
      name: "complet",
      description:
        "Pour envoyer une description complète de la carte (et non seulement l'image)",
      required: false,
    },
    {
      type: ApplicationCommandOptionTypes.BOOLEAN,
      name: "dos",
      description: "Pour envoyer le dos de la carte",
      required: false,
    },
  ];

  private CARD_CODE_REGEX = /(\d{5})(b?)$/;

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<ISlashCommandResult> {
    const search = commandInteraction.options.getString("recherche");
    const xp = commandInteraction.options.getInteger("xp");
    const extended = commandInteraction.options.getBoolean("complet") || false;
    const back = commandInteraction.options.getBoolean("dos") || false;

    if (search) {
      const searchOptions: SearchOptions = {
        xp: xp !== null ? (xp === 0 ? "all" : xp) : "none",
        extended,
        back,
        searchType: this.CARD_CODE_REGEX.test(search)
          ? SearchType.BY_CODE
          : SearchType.BY_TITLE,
        searchString: search,
      };

      let foundCards: ArkhamDBCard[] = [];
      foundCards = this.cardService.getCards({
        searchString: searchOptions.searchString,
        searchType: searchOptions.searchType,
        includeSameNameCards: searchOptions.xp !== "none",
      });

      if (typeof searchOptions.xp === "number") {
        foundCards = foundCards.filter((card) => card.xp === searchOptions.xp);
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
          await menu.replyToInteraction(commandInteraction);
          return {
            message: `[CardCommand] Cartes envoyées pour la recherche ${search}`,
          };
        } else {
          await commandInteraction.reply({ embeds: [embeds[0]] });
          return {
            message: `[CardCommand] Carte envoyée pour la recherche ${search}`,
          };
        }
      } else {
        await commandInteraction.reply(
          "Désolé, le mystère de cette carte reste entier."
        );
        return {
          message: `[CardCommand] Aucune carte correspondant à la recherche ${search}`,
        };
      }
    } else {
      return { message: "[CardCommand] Texte recherché non fourni" };
    }
  }
}

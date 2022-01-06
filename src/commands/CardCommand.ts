import { CommandInteraction, SelectMenuInteraction } from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import { IApplicationCommand, IApplicationCommandResult } from "../interfaces";
import { ArkhamDBCard, CardService, SearchType } from "../services/CardService";

import { selectCard } from "./utils/selectCard";

interface SearchOptions {
  extended: boolean;
  back: boolean;
  searchType: SearchType;
  searchString: string;
  ephemeral: boolean;
}

export class CardCommand implements IApplicationCommand {
  @Inject private cardService!: CardService;

  isGuildCommand = false;
  name = "c";
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
    {
      type: ApplicationCommandOptionTypes.BOOLEAN,
      name: "ephemere",
      description: "Si vrai, seul toi pourra voir la réponse",
      required: false,
    },
  ];

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    const search = commandInteraction.options.getString("recherche");
    const extended = commandInteraction.options.getBoolean("complet") || false;
    const back = commandInteraction.options.getBoolean("dos") || false;
    const ephemeral =
      commandInteraction.options.getBoolean("ephemere") || false;

    if (search) {
      const searchOptions: SearchOptions = {
        extended,
        back,
        searchType: CardService.CARD_CODE_REGEX.test(search)
          ? SearchType.BY_CODE
          : SearchType.BY_TITLE,
        searchString: search,
        ephemeral,
      };

      let foundCards: ArkhamDBCard[] = [];
      foundCards = this.cardService.getCards({
        searchString: searchOptions.searchString,
        searchType: searchOptions.searchType,
      });

      if (foundCards.length > 0) {
        if (foundCards.length === 1) {
          return this.sendCard(
            commandInteraction,
            foundCards[0],
            searchOptions
          );
        } else {
          return this.sendCardChoices(
            commandInteraction,
            foundCards,
            searchOptions
          );
        }
      } else {
        await commandInteraction.reply(
          "Désolé, le mystère de cette carte reste entier."
        );
        return {
          cmd: "CardCommand",
          result: `Aucune carte correspondant à la recherche ${search}`,
        };
      }
    } else {
      return { cmd: "CardCommand", result: "Texte recherché non fourni" };
    }
  }

  private async sendCard(
    interaction: CommandInteraction | SelectMenuInteraction,
    card: ArkhamDBCard,
    options: SearchOptions
  ): Promise<IApplicationCommandResult> {
    const cardEmbed = await this.cardService.createEmbed(card, {
      back: options.back,
      extended: options.extended,
    });
    await interaction.reply({
      embeds: [cardEmbed],
      ephemeral: options.ephemeral,
    });
    return { cmd: "CardCommand", result: `Carte envoyée` };
  }

  private async sendCardChoices(
    interaction: CommandInteraction,
    cards: ArkhamDBCard[],
    options: SearchOptions
  ): Promise<IApplicationCommandResult> {
    return selectCard(
      "CardCommand",
      interaction,
      cards,
      async (selectMenuInteraction, selectedCard) => {
        await this.sendCard(selectMenuInteraction, selectedCard, options);
      }
    );
  }
}

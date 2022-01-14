import { CommandInteraction, SelectMenuInteraction } from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import {
  ApplicationCommandAccess,
  IApplicationCommand,
  IApplicationCommandResult,
} from "../interfaces";
import { ArkhamDBCard, CardService, SearchType } from "../services/CardService";

import { selectCard } from "./utils/selectCard";

/** Options de recherche et d'affichage des cartes */
interface SearchOptions {
  /** Pour un affichage complet */
  extended: boolean;

  /** Pour affichage du dos de la carte */
  back: boolean;

  /** Type de recherche */
  searchType: SearchType;

  /** Recherche */
  searchString: string;

  /** Pour un affichage éphémère */
  ephemeral: boolean;
}

/**
 * Commande pour l'affichage des cartes
 */
export class CardCommand implements IApplicationCommand {
  @Inject private cardService!: CardService;

  commandAccess = ApplicationCommandAccess.GLOBAL;

  commandData = {
    name: "c",
    description: `Pour l'affichage de carte(s)`,
    options: [
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
    ],
  };

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

  /**
   * Envoie la carte trouvée.
   *
   * @param interaction L'interaction déclenchée par la commande
   * @param card La carte à afficher
   * @param options Les options d'affichage
   * @returns Une promesse résolue avec le résultat de la commande
   */
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

  /**
   * Envoie à l'utilisateur un menu de sélection de carte parmi plusieurs cartes
   * ramenées par la recherche effectuée.
   *
   * @param interaction L'interaction déclenchée par la commande
   * @param cards Les cartes trouvées parmi lesquelles choisir
   * @param options Les options d'affichage
   * @returns Une promesse résolue avec le résultat de la commande
   */
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

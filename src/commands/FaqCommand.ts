import { CommandInteraction, SelectMenuInteraction } from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import { IApplicationCommand, IApplicationCommandResult } from "../interfaces";
import { ArkhamDBCard, CardService, SearchType } from "../services/CardService";
import { caseOfLength } from "../utils";

import { selectCard } from "./utils/selectCard";

/**
 * Commande permettant d'afficher les entrées de FAQ correspondant à une carte.
 */
export class FaqCommand implements IApplicationCommand {
  @Inject private cardService!: CardService;

  isGuildCommand = false;
  name = "faq";
  description = "Affichage de la FAQ associée à la carte";
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
      name: "ephemere",
      description: "Si vrai, seul toi pourra voir la réponse",
      required: false,
    },
  ];

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    const search = commandInteraction.options.getString("recherche");
    const ephemeral =
      commandInteraction.options.getBoolean("ephemere") || false;

    if (search) {
      const searchType = CardService.CARD_CODE_REGEX.test(search)
        ? SearchType.BY_CODE
        : SearchType.BY_TITLE;

      const foundCards = this.cardService.getCards({
        searchString: search,
        searchType,
      });

      return caseOfLength(foundCards, {
        ifOne: (theCard) =>
          this.sendFaqEntries(commandInteraction, theCard, ephemeral),
        ifMany: (allCards) =>
          this.sendCardChoicesThenFaqEntries(
            commandInteraction,
            allCards,
            ephemeral
          ),
        ifEmpty: () => this.noCardMatched(commandInteraction),
      });
    } else {
      await commandInteraction.reply({
        content: "Désolé, je n'ai pas compris la demande",
        ephemeral: true,
      });
      return this.commandResult("Texte recherché non fourni");
    }
  }

  /**
   * Pour envoyer les entrées de FAQ concernant la carte fournie.
   *
   * @param interaction L'interaction à l'origine de l'exécution de cette commande
   * @param card La carte concernée
   * @returns Le résultat de l'exécution de la commande
   */
  private async sendFaqEntries(
    interaction: CommandInteraction | SelectMenuInteraction,
    card: ArkhamDBCard,
    ephemeral: boolean
  ): Promise<IApplicationCommandResult> {
    const faqEntries = await this.cardService.getCardFAQ(card);
    if (faqEntries.length > 0) {
      await interaction.reply({
        embeds: [this.cardService.createFaqEmbed(card, faqEntries)],
        ephemeral,
      });
      return this.commandResult("FAQ envoyée");
    } else {
      await interaction.reply({
        content: `Aucune entrée de FAQ pour la carte ${card.name}`,
        ephemeral: true,
      });
      return this.commandResult("Aucune FAQ pour cette carte");
    }
  }

  /**
   * Envoie à l'utilisateur les cartes correspondant à sa recherche et parmi
   * lesquelles il devra choisir pour ensuite obtenir les entrées de FAQ.
   *
   * @param interaction L'interaction à l'origine de l'exécution de cette commande
   * @param cards Les cartes trouvées et parmi lesquelles il faudra choisir
   */
  private async sendCardChoicesThenFaqEntries(
    interaction: CommandInteraction,
    cards: ArkhamDBCard[],
    ephemeral: boolean
  ): Promise<IApplicationCommandResult> {
    return selectCard(
      "FaqCommand",
      interaction,
      cards,
      async (selectMenuInteraction, selectedCard) => {
        await this.sendFaqEntries(
          selectMenuInteraction,
          selectedCard,
          ephemeral
        );
      }
    );
  }

  /**
   * Pour indiquer qu'aucune carte ne correspond à la recherche.
   *
   * @param interaction L'interaction à l'origine de l'exécution de cette commande
   * @returns Le résultat de l'exécution de la commande
   */
  private async noCardMatched(
    interaction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    await interaction.reply({
      content: "Aucune carte ne correspond à cette recherche",
      ephemeral: true,
    });
    return this.commandResult(
      `Aucune carte ne correspond à la recherche ${
        interaction.options.getString("recherche") || ""
      }`
    );
  }

  private commandResult(
    result: string,
    meta?: Omit<IApplicationCommandResult, "cmd" | "result">
  ) {
    return { cmd: "FaqCommand", result, ...meta };
  }
}

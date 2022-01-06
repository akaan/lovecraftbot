import { CommandInteraction } from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import { IApplicationCommand, IApplicationCommandResult } from "../interfaces";
import { CardService, SearchType } from "../services/CardService";

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

      if (foundCards.length > 0) {
        if (foundCards.length === 1) {
          const theCard = foundCards[0];
          const faqEntries = await this.cardService.getCardFAQ(theCard);
          if (faqEntries.length > 0) {
            await commandInteraction.reply({
              content: faqEntries[0].text,
              ephemeral,
            });
            return { cmd: "FaqCommand", result: "FAQ envoyée" };
          } else {
            await commandInteraction.reply({
              content: `Aucune entrée de FAQ pour la carte ${theCard.name}`,
              ephemeral: true,
            });
            return { cmd: "FaqCommand", result: "Aucune FAQ pour cette carte" };
          }
        } else {
          await commandInteraction.reply({
            content: "Je ne sais pas encore faire cela",
            ephemeral: true,
          });
          return { cmd: "FaqCommand", result: "Non supporté" };
        }
      } else {
        await commandInteraction.reply({
          content: "Aucune carte ne correspond à cette recherche",
          ephemeral: true,
        });
        return {
          cmd: "FaqCommand",
          result: `Aucune carte ne correspond à la recherche ${search}`,
        };
      }
    } else {
      await commandInteraction.reply({
        content: "Désolé, j'ai mal compris la demande",
        ephemeral: true,
      });
      return { cmd: "FaqCommand", result: "Texte recherché non fourni" };
    }
  }
}

import { CommandInteraction } from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import { IApplicationCommand, IApplicationCommandResult } from "../interfaces";
import { DeckService } from "../services/DeckService";

/** Commande pour l'affichage d'un deck */
export class DeckCommand implements IApplicationCommand {
  @Inject private deckService!: DeckService;

  isGuildCommand = false;
  name = "deck";
  description = "Affiche le deck correspondant à l'ID fourni";
  options = [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "deckid",
      description: "L'identifiant du deck sur ArkhamDB",
      required: true,
    },
  ];

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    const deckId = commandInteraction.options.getString("deckid");
    if (deckId) {
      const deck = await this.deckService.getDeck(deckId);
      if (deck) {
        const deckEmbed = this.deckService.createEmbed(deck);
        await commandInteraction.reply({ embeds: [deckEmbed] });
        return { cmd: "DeckCommand", result: `Deck envoyé` };
      } else {
        await commandInteraction.reply(
          `désolé, je ne trouve pas de deck avec l'ID ${deckId}.\n*Il est aussi possible que l'auteur n'ait pas rendu ses decks publics.*`
        );
        return {
          cmd: "DeckCommand",
          result: `Aucun deck correspondant à l'ID ${deckId}`,
        };
      }
    } else {
      return { cmd: "DeckCommand", result: `ID de deck non fourni` };
    }
  }
}

import { CommandInteraction } from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import { ISlashCommand, ISlashCommandResult } from "../interfaces";
import { DeckService } from "../services/DeckService";

export class DeckCommand implements ISlashCommand {
  @Inject private deckService!: DeckService;

  isAdmin = false;
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
  ): Promise<ISlashCommandResult> {
    const deckId = commandInteraction.options.getString("deckid");
    if (deckId) {
      const deck = await this.deckService.getDeck(deckId);
      if (deck) {
        const deckEmbed = this.deckService.createEmbed(deck);
        await commandInteraction.reply({ embeds: [deckEmbed] });
        return { message: `[DeckCommand] Deck envoyé` };
      } else {
        await commandInteraction.reply(
          `désolé, je ne trouve pas de deck avec l'ID ${deckId}.\n*Il est aussi possible que l'auteur n'ait pas rendu ses decks publics.*`
        );
        return {
          message: `[DeckCommand] Aucun deck correspondant à l'ID ${deckId}`,
        };
      }
    } else {
      return { message: `[DeckCommand] ID de deck non fourni` };
    }
  }
}

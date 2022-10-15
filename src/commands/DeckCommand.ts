import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { Inject } from "typescript-ioc";

import {
  ApplicationCommandAccess,
  IApplicationCommand,
  IApplicationCommandResult,
} from "../interfaces";
import { DeckService } from "../services/DeckService";

/** Commande pour l'affichage d'un deck */
export class DeckCommand implements IApplicationCommand {
  @Inject private deckService!: DeckService;

  commandAccess = ApplicationCommandAccess.GLOBAL;

  commandData = new SlashCommandBuilder()
    .setName("deck")
    .setDescription("Affiche le deck correspondant à l'ID fourni")
    .addStringOption((option) =>
      option
        .setName("deckid")
        .setDescription("L'identifiant du deck sur ArkhamDB")
        .setRequired(true)
    );

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    if (!commandInteraction.isChatInputCommand()) {
      await commandInteraction.reply("Oups, y'a eu un problème");
      return { cmd: "DeckCommand", result: "Interaction hors chat" };
    }

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

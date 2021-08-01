import { Inject } from "typescript-ioc";

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { DeckService } from "../services/DeckService";

export class DeckCommand implements ICommand {
  aliases = ["deck"];
  help = "Affiche le deck correspondant à l'ID fourni";

  @Inject private deckService?: DeckService;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    if (!this.deckService) {
      return {
        resultString: `[DeckCommand] DecklistService indisponible`,
      };
    }

    const { message, args } = cmdArgs;
    const deck = await this.deckService.getDeck(args);
    if (deck) {
      await message.reply(this.deckService.createEmbed(deck));

      return {
        resultString: `[DeckCommand] Deck envoyé`,
      };
    }

    await message.reply(
      `désolé, je ne trouve pas de deck avec l'ID ${args}.\n*Il est aussi possible que l'auteur n'ait pas rendu ses decks publics.*`
    );

    return {
      resultString: `[DeckCommand] Aucun deck correspondant à ${args}`,
    };
  }
}

import {
  ApplicationCommandSubCommandData,
  CommandInteraction,
} from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import {
  ApplicationCommandAccess,
  IApplicationCommand,
  IApplicationCommandResult,
} from "../interfaces";
import { CardService } from "../services/CardService";

/** Commande de traduction des titres de cartes */
export class TradCommand implements IApplicationCommand {
  @Inject private cardService!: CardService;

  commandAccess = ApplicationCommandAccess.GLOBAL;

  commandData = {
    name: "trad",
    description: `Traduit un nom de carte`,
    options: [
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "f",
        description: "Anglais > Français",
        options: [
          {
            type: ApplicationCommandOptionTypes.STRING,
            name: "nom",
            description: "Nom anglais de la carte",
            required: true,
          },
          {
            type: ApplicationCommandOptionTypes.BOOLEAN,
            name: "ephemere",
            description: "Si vrai, seul toi pourra voir la réponse",
            required: false,
          },
        ],
      } as ApplicationCommandSubCommandData,
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "e",
        description: "Français > Anglais",
        options: [
          {
            type: ApplicationCommandOptionTypes.STRING,
            name: "nom",
            description: "Nom français de la carte",
            required: true,
          },
          {
            type: ApplicationCommandOptionTypes.BOOLEAN,
            name: "ephemere",
            description: "Si vrai, seul toi pourra voir la réponse",
            required: false,
          },
        ],
      } as ApplicationCommandSubCommandData,
    ],
  };

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    const cardName = commandInteraction.options.getString("nom");
    const ephemeral =
      commandInteraction.options.getBoolean("ephemere") || false;

    if (cardName) {
      if (commandInteraction.options.getSubcommand() === "f") {
        const maybeFrenchName = this.cardService.getFrenchCardName(cardName);
        if (maybeFrenchName) {
          await commandInteraction.reply({
            content: `${maybeFrenchName}`,
            ephemeral,
          });
          return { cmd: "TradCommand", result: `Nom français envoyé"` };
        } else {
          await commandInteraction.reply({
            content: `Désolé, je ne trouve pas de nom français pour ${cardName}`,
            ephemeral,
          });
          return { cmd: "TradCommand", result: `Pas de nom français trouvé"` };
        }
      }

      if (commandInteraction.options.getSubcommand() === "e") {
        const maybeEnglishName = this.cardService.getEnglishCardName(cardName);
        if (maybeEnglishName) {
          await commandInteraction.reply({
            content: `${maybeEnglishName}`,
            ephemeral,
          });
          return { cmd: "TradCommand", result: `Nom anglais envoyé` };
        } else {
          await commandInteraction.reply({
            content: `Désolé, je ne trouve pas de nom anglais pour ${cardName}`,
            ephemeral,
          });
          return { cmd: "TradCommand", result: `Pas de nom anglais trouvé` };
        }
      }

      await commandInteraction.reply(`Oops, il y a eu un problème`);
      return {
        cmd: "TradCommand",
        result: `Sous-commande ${commandInteraction.options.getSubcommand()} inconnue`,
      };
    } else {
      return { cmd: "TradCommand", result: "Nom non fourni" };
    }
  }
}

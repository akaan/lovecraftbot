import {
  ApplicationCommandSubCommandData,
  CommandInteraction,
} from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import { IApplicationCommand, IApplicationCommandResult } from "../interfaces";
import { CardOfTheDayService } from "../services/CardOfTheDayService";

/**
 * Commande d'administration de la carte du jour
 */
export class CardOfTheDayCommand implements IApplicationCommand {
  @Inject private cardOfTheDayService!: CardOfTheDayService;

  isGuildCommand = true;

  commandData = {
    name: "cotd",
    description: "Commandes de gestion de la carte du jour",
    options: [
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "encore",
        description: "Retire une nouvelle carte du jour",
      } as ApplicationCommandSubCommandData,
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "liste",
        description: "Liste des cartes déjà tirées",
      } as ApplicationCommandSubCommandData,
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "ajouter",
        description: "Ajoute des cartes à la liste des cartes déjà tirées",
        options: [
          {
            type: ApplicationCommandOptionTypes.STRING,
            name: "codes",
            description:
              "Codes des cartes (séparés par des virgules) à ajouter à la liste des cartes déjà tirées",
            required: true,
          },
        ],
      } as ApplicationCommandSubCommandData,
    ],
  };

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    if (commandInteraction.options.getSubcommand() === "encore") {
      await this.cardOfTheDayService.sendCardOfTheDay();
      await commandInteraction.reply({
        content: "Nouvelle carte tirée !",
        ephemeral: true,
      });
      return {
        cmd: "CardOfTheDayCommand",
        result: `Nouvelle carte du jour envoyée`,
      };
    }

    if (commandInteraction.options.getSubcommand() === "liste") {
      await commandInteraction.reply({
        content: this.cardOfTheDayService.getCardCodesSent().join(", "),
        ephemeral: true,
      });
      return {
        cmd: "CardOfTheDayCommand",
        result: `Liste des cartes du jour déjà tirées envoyée`,
      };
    }

    if (commandInteraction.options.getSubcommand() === "ajouter") {
      const codesText = commandInteraction.options.getString("codes");
      if (codesText) {
        const codes = codesText.split(",").map((s) => s.trim());
        await this.cardOfTheDayService.addCardSent(codes);
        await commandInteraction.reply({
          content: `Ces ${codes.length} carte(s) ont été ajoutée(s) à la liste des cartes déjà tirées`,
          ephemeral: true,
        });

        return { cmd: "CardOfTheDayCommand", result: "Codes ajoutés" };
      } else {
        return {
          cmd: "CardOfTheDayCommand",
          result: `Codes de carte non fournis`,
        };
      }
    }

    await commandInteraction.reply({
      content: `Oops, il y a eu un problème`,
      ephemeral: true,
    });
    return {
      cmd: "CardOfTheDayCommand",
      result: `Sous-commande ${commandInteraction.options.getSubcommand()} inconnue`,
    };
  }
}

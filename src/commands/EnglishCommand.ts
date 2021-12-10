import { CommandInteraction } from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import { ISlashCommand, ISlashCommandResult } from "../interfaces";

import { CardService } from "../services/CardService";

export class EnglishCommand implements ISlashCommand {
  @Inject private cardService!: CardService;

  isAdmin = false;
  name = "e";
  description = `Affiche le nom anglais de la carte indiquée (recherche exacte)`;
  options = [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "nom",
      description: "Nom français de la carte",
      required: true,
    },
  ];

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<ISlashCommandResult> {
    const frenchName = commandInteraction.options.getString("nom");
    if (frenchName) {
      const maybeEnglishName = this.cardService.getEnglishCardName(frenchName);
      if (maybeEnglishName) {
        await commandInteraction.reply(`${maybeEnglishName}`);
        return { message: `[EnglishCommand] Nom anglais envoyé"` };
      } else {
        await commandInteraction.reply(
          `Désolé, je ne trouve pas de nom anglais pour ${frenchName}`
        );
        return { message: `[EnglishCommand] Pas de nom anglais trouvé"` };
      }
    } else {
      return { message: "[EnglishCommand] Nom français non fourni" };
    }
  }
}

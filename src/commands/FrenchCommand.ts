import { CommandInteraction } from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import { ISlashCommand, ISlashCommandResult } from "../interfaces";
import { CardService } from "../services/CardService";

export class FrenchCommand implements ISlashCommand {
  @Inject private cardService!: CardService;

  isAdmin = false;
  name = "f";
  description = `Affiche le nom français de la carte indiquée (recherche exacte)`;
  options = [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "nom",
      description: "Nom anglais de la carte",
      required: true,
    },
  ];

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<ISlashCommandResult> {
    const englishName = commandInteraction.options.getString("nom");
    if (englishName) {
      const maybeFrenchName = this.cardService.getFrenchCardName(englishName);
      if (maybeFrenchName) {
        await commandInteraction.reply(`${maybeFrenchName}`);
        return { message: `[FrenchCommand] Nom français envoyé"` };
      } else {
        await commandInteraction.reply(
          `Désolé, je ne trouve pas de nom français pour ${englishName}`
        );
        return { message: `[FrenchCommand] Pas de nom français trouvé"` };
      }
    } else {
      return { message: "[FrenchCommand] nom anglais non fourni" };
    }
  }
}

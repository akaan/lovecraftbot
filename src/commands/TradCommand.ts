import { CommandInteraction, SlashCommandBuilder } from "discord.js";
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

  commandData = new SlashCommandBuilder()
    .setName("trad")
    .setDescription(`Traduit un nom de carte`)
    .addSubcommand((subCommand) =>
      subCommand
        .setName("f")
        .setDescription("Anglais > Français")
        .addStringOption((option) =>
          option
            .setName("nom")
            .setDescription("Nom anglais de la carte")
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option
            .setName("ephemere")
            .setDescription("Si vrai, seul toi pourra voir la réponse")
            .setRequired(false)
        )
    )
    .addSubcommand((subCommand) =>
      subCommand
        .setName("e")
        .setDescription("Français > Anglais")
        .addStringOption((option) =>
          option
            .setName("nom")
            .setDescription("Nom français de la carte")
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option
            .setName("ephemere")
            .setDescription("Si vrai, seul toi pourra voir la réponse")
            .setRequired(false)
        )
    );

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    if (!commandInteraction.isChatInputCommand()) {
      await commandInteraction.reply("Oups, y'a eu un problème");
      return { cmd: "TradCommand", result: "Interaction hors chat" };
    }

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

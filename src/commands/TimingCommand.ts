import { CommandInteraction, SlashCommandBuilder } from "discord.js";

import {
  ApplicationCommandAccess,
  IApplicationCommand,
  IApplicationCommandResult,
} from "../interfaces";

/** Commande d'affichage des diagrammes de timing du jeu */
export class TimingCommand implements IApplicationCommand {
  commandAccess = ApplicationCommandAccess.GLOBAL;

  commandData = new SlashCommandBuilder()
    .setName("t")
    .setDescription("Affiche un timing")
    .addSubcommand((subCommand) =>
      subCommand
        .setName("phases")
        .setDescription("Affiche le timing des phases du jeu")
    )
    .addSubcommand((subCommand) =>
      subCommand.setName("test").setDescription("Affiche le timing d'un test")
    );

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    if (!commandInteraction.isChatInputCommand()) {
      await commandInteraction.reply("Oups, y'a eu un problème");
      return { cmd: "TimingCommand", result: "Interaction hors chat" };
    }

    if (commandInteraction.options.getSubcommand() === "phases") {
      await commandInteraction.reply({ files: ["assets/phase.jpg"] });
      return {
        cmd: "TimingCommand",
        result: "Timing des phases envoyé",
      };
    }

    if (commandInteraction.options.getSubcommand() === "test") {
      await commandInteraction.reply({ files: ["assets/timing.jpg"] });
      return {
        cmd: "TimingCommand",
        result: "Timing d'un test envoyé",
      };
    }

    await commandInteraction.reply(`Oops, il y a eu un problème`);
    return {
      cmd: "TimingCommand",
      result: `Sous-commandes ${commandInteraction.options.getSubcommand()} inconnue`,
    };
  }
}

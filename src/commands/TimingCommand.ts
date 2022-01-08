import { CommandInteraction } from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";

import { IApplicationCommand, IApplicationCommandResult } from "../interfaces";

/** Commande d'affichage des diagrammes de timing du jeu */
export class TimingCommand implements IApplicationCommand {
  isGuildCommand = false;
  name = "t";
  description = "Affiche un timing";
  options = [
    {
      type: ApplicationCommandOptionTypes.SUB_COMMAND,
      name: "phases",
      description: "Affiche le timing des phases du jeu",
    },
    {
      type: ApplicationCommandOptionTypes.SUB_COMMAND,
      name: "test",
      description: "Affiche le timing d'un test",
    },
  ];

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
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

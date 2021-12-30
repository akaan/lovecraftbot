import { CommandInteraction } from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";

import { ISlashCommand, ISlashCommandResult } from "../interfaces";

export class TimingCommand implements ISlashCommand {
  isAdmin = false;
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
  ): Promise<ISlashCommandResult> {
    if (commandInteraction.options.getSubcommand() === "phases") {
      await commandInteraction.reply({ files: ["assets/phase.jpg"] });
      return {
        message: "[TimingCommand] Timing des phases envoyé",
      };
    }

    if (commandInteraction.options.getSubcommand() === "test") {
      await commandInteraction.reply({ files: ["assets/timing.jpg"] });
      return {
        message: "[TimingCommand] Timing d'un test envoyé",
      };
    }

    await commandInteraction.reply(`Oops, il y a eu un problème`);
    return {
      message: `[TimingCommand] Sous-commandes ${commandInteraction.options.getSubcommand()} inconnue`,
    };
  }
}

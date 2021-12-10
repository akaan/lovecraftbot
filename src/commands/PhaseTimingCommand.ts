import { CommandInteraction } from "discord.js";
import { ISlashCommand, ISlashCommandResult } from "../interfaces";

export class PhaseTimingCommand implements ISlashCommand {
  isAdmin = false;
  name = "p";
  description = "Affiche le timing des phases de jeu";

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<ISlashCommandResult> {
    await commandInteraction.reply({ files: ["assets/phase.jpg"] });
    return {
      message: "[PhaseTimingCommand] Timing des phases envoyé",
    };
  }
}

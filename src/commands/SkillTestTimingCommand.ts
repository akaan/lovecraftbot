import { CommandInteraction } from "discord.js";
import { ISlashCommand, ISlashCommandResult } from "../interfaces";

export class SkillTestTimingCommand implements ISlashCommand {
  isAdmin = false;
  name = "t";
  description = "Affiche le timing d'un test de compétence";

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<ISlashCommandResult> {
    await commandInteraction.reply({ files: ["assets/timing.jpg"] });
    return {
      message: "[SkillTestTimingCommand] Timing envoyé",
    };
  }
}

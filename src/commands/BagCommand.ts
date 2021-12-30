import { CommandInteraction } from "discord.js";
import { Inject } from "typescript-ioc";

import { ISlashCommand, ISlashCommandResult } from "../interfaces";
import { ChaosBagService } from "../services/ChaosBagService";

export class BagCommand implements ISlashCommand {
  @Inject private chaosBagService!: ChaosBagService;

  isAdmin = false;
  name = "bag";
  description = "Tire un jeton chaos (Nuit de la Zélatrice Standard)";

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<ISlashCommandResult> {
    await commandInteraction.reply(this.chaosBagService.pullToken() || "??");
    return { message: "[BagCommand] Jeton envoyé" };
  }
}

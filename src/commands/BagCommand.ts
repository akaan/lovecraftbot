import { CommandInteraction } from "discord.js";
import { Inject } from "typescript-ioc";

import { IApplicationCommand, IApplicationCommandResult } from "../interfaces";
import { ChaosBagService } from "../services/ChaosBagService";

export class BagCommand implements IApplicationCommand {
  @Inject private chaosBagService!: ChaosBagService;

  isGuildCommand = false;
  name = "bag";
  description = "Tire un jeton chaos (Nuit de la Zélatrice Standard)";

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    await commandInteraction.reply(this.chaosBagService.pullToken() || "??");
    return { message: "[BagCommand] Jeton envoyé" };
  }
}

import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { Inject } from "typescript-ioc";

import {
  ApplicationCommandAccess,
  IApplicationCommand,
  IApplicationCommandResult,
} from "../interfaces";
import { ChaosBagService } from "../services/ChaosBagService";

/**
 * Commande permettant de tirer un jeton au hasard dans la réserve du Chaos.
 */
export class BagCommand implements IApplicationCommand {
  @Inject private chaosBagService!: ChaosBagService;

  commandAccess = ApplicationCommandAccess.GLOBAL;

  commandData = new SlashCommandBuilder()
    .setName("bag")
    .setDescription("Tire un jeton chaos (Nuit de la Zélatrice Standard)");

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    await commandInteraction.reply(this.chaosBagService.pullToken() || "??");
    return { cmd: "BagCommand", result: "Jeton envoyé" };
  }
}

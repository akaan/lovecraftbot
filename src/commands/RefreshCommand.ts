import { CommandInteraction } from "discord.js";
import { Inject } from "typescript-ioc";

import { IApplicationCommand, IApplicationCommandResult } from "../interfaces";
import { CardService } from "../services/CardService";

/**
 * Commande de raffraîchissement de la base de données locale du bot concernant
 * les cartes
 */
export class RefreshCommand implements IApplicationCommand {
  @Inject private cardService!: CardService;

  isGuildCommand = true;

  commandData = {
    name: "refresh",
    description: "Recharge les toutes dernières cartes depuis ArkhamDB",
  };

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    await commandInteraction.deferReply();

    await this.cardService.refreshData();

    await commandInteraction.editReply(
      "C'est bon, les cartes, packs et taboos ont été rechargés !"
    );
    return {
      cmd: "RefreshCommand",
      result: "Cartes, packs et taboo rechargés depuis ArkhamDB",
    };
  }
}

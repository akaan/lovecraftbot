import { CommandInteraction } from "discord.js";
import { Inject } from "typescript-ioc";

import { IApplicationCommand, IApplicationCommandResult } from "../interfaces";
import { CardService } from "../services/CardService";

export class RefreshCommand implements IApplicationCommand {
  @Inject private cardService!: CardService;

  isGuildCommand = true;
  name = "refresh";
  description = "Recharge les toutes dernières cartes depuis ArkhamDB";

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    await this.cardService.downloadLatestCardDb();

    await commandInteraction.reply(
      "C'est bon, les cartes ont été rechargées !"
    );
    return {
      cmd: "RefreshCommand",
      result: "Cartes rechargées depuis ArkhamDB",
    };
  }
}

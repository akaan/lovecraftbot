import { ISlashCommand, ISlashCommandResult } from "../interfaces";
import { CardService } from "../services/CardService";
import { Inject } from "typescript-ioc";
import { CommandInteraction } from "discord.js";

export class RefreshCommand implements ISlashCommand {
  @Inject private cardService!: CardService;

  isAdmin = true;
  name = "refresh";
  description = "Recharge les toutes dernières cartes depuis ArkhamDB";

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<ISlashCommandResult> {
    await this.cardService.downloadLatestCardDb();

    await commandInteraction.reply(
      "C'est bon, les cartes ont été rechargées !"
    );
    return {
      message: "[RefreshCommand] Cartes rechargées depuis ArkhamDB",
    };
  }
}

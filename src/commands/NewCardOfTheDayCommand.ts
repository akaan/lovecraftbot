import { ISlashCommand, ISlashCommandResult } from "../interfaces";
import { Inject } from "typescript-ioc";
import { CardOfTheDayService } from "../services/CardOfTheDayService";
import { CommandInteraction } from "discord.js";

export class NewCardOfTheDayCommand implements ISlashCommand {
  @Inject private cardOfTheDayService!: CardOfTheDayService;

  isAdmin = true;
  name = "retire";
  description = "Retire une nouvelle carte du jour";

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<ISlashCommandResult> {
    await this.cardOfTheDayService.sendCardOfTheDay();
    await commandInteraction.reply("Et voilà!");
    return {
      message: `[NewCardOfTheDayCommand] Nouvelle carte du jour envoyée`,
    };
  }
}

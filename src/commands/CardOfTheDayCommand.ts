import { ISlashCommand, ISlashCommandResult } from "../interfaces";
import { Inject } from "typescript-ioc";
import { CardOfTheDayService } from "../services/CardOfTheDayService";
import { CommandInteraction } from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";

export class CardOfTheDayCommand implements ISlashCommand {
  @Inject private cardOfTheDayService!: CardOfTheDayService;

  isAdmin = true;
  name = "cotd";
  description =
    "Ajoute les codes de cartes précisés à la liste des cartes déjà tirées";
  options = [
    {
      type: ApplicationCommandOptionTypes.SUB_COMMAND,
      name: "encore",
      description: "Retire une nouvelle carte du jour",
    },
    {
      type: ApplicationCommandOptionTypes.SUB_COMMAND,
      name: "ajouter",
      description: "Ajoute des cartes à la liste des cartes déjà tirées",
      userOptions: [
        {
          type: ApplicationCommandOptionTypes.STRING,
          name: "codes",
          description:
            "Codes des cartes (séparés par des virgules) à ajouter à la liste des cartes déjà tirées",
          required: true,
        },
      ],
    },
  ];

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<ISlashCommandResult> {
    if (commandInteraction.options.getSubcommand() === "encore") {
      await this.cardOfTheDayService.sendCardOfTheDay();
      await commandInteraction.reply("Et voilà!");
      return {
        message: `[CardOfTheDayCommand] Nouvelle carte du jour envoyée`,
      };
    }

    if (commandInteraction.options.getSubcommand() === "ajouter") {
      const codesText = commandInteraction.options.getString("codes");
      if (codesText) {
        const codes = codesText.split(",").map((s) => s.trim());
        await this.cardOfTheDayService.addCardSent(codes);
        await commandInteraction.reply(
          `Ces ${codes.length} carte(s) ont été ajoutée(s) à la liste des cartes déjà tirées`
        );

        return { message: "[CardOfTheDayCommand] Codes ajoutés" };
      } else {
        return { message: `[CardOfTheDayCommand] Codes de carte non fournis` };
      }
    }

    await commandInteraction.reply(`Oops, il y a eu un problème`);
    return {
      message: `[CardOfTheDayCommand] Sous-commande ${commandInteraction.options.getSubcommand()} inconnue`,
    };
  }
}

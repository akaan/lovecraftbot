import { CommandInteraction } from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import { IApplicationCommand, IApplicationCommandResult } from "../interfaces";
import { CardService } from "../services/CardService";

/**
 * Commande permettant d'afficher les entrées de FAQ correspondant à une carte.
 */
export class FaqCommand implements IApplicationCommand {
  @Inject private cardService!: CardService;

  isGuildCommand = false;
  name = "faq";
  description = "Affichage de la FAQ associée à la carte";
  options = [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "recherche",
      description:
        "Code de la carte ou texte à chercher dans le titre de la carte",
      required: true,
    },
    {
      type: ApplicationCommandOptionTypes.BOOLEAN,
      name: "ephemere",
      description: "Si vrai, seul toi pourra voir la réponse",
      required: false,
    },
  ];

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    await commandInteraction.reply({
      content: "Je ne sais pas encore fait cela",
      ephemeral: true,
    });
    return { cmd: "FaqCommand", result: "FAQ envoyée" };
  }
}

import {
  ApplicationCommandSubCommandData,
  ApplicationCommandSubGroupData,
  CommandInteraction,
} from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";

import {
  ApplicationCommandAccess,
  IApplicationCommand,
  IApplicationCommandResult,
} from "../interfaces";

/** Commande de gestion des événements multijoueurs */
export class EventCommand implements IApplicationCommand {
  commandAccess = ApplicationCommandAccess.ADMIN;

  commandData = {
    name: "evt",
    description: `Commandes de gestion des événements multijoueurs`,
    options: [
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "start",
        description: "Démarre un événement multijoueurs",
        options: [
          {
            type: ApplicationCommandOptionTypes.INTEGER,
            name: "joueurs",
            description: "Nombre de joueurs",
            required: true,
          },
          {
            type: ApplicationCommandOptionTypes.INTEGER,
            name: "groupes",
            description: "Nombre de groupes",
            required: true,
          },
        ],
      } as ApplicationCommandSubCommandData,
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
        name: "timer",
        description: "Gestion de la minuterie",
        options: [
          {
            type: ApplicationCommandOptionTypes.SUB_COMMAND,
            name: "start",
            description: "Démarre la minuterie",
            options: [
              {
                type: ApplicationCommandOptionTypes.INTEGER,
                name: "minutes",
                description: "Nombre de minutes",
                required: true,
              },
            ],
          } as ApplicationCommandSubCommandData,
          {
            type: ApplicationCommandOptionTypes.SUB_COMMAND,
            name: "pause",
            description: "Met la minuterie en pause",
          } as ApplicationCommandSubCommandData,
          {
            type: ApplicationCommandOptionTypes.SUB_COMMAND,
            name: "resume",
            description: "Redémarre la minuterie",
          } as ApplicationCommandSubCommandData,
        ],
      } as ApplicationCommandSubGroupData,
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "msg",
        description: "Envoie un message à tous les groupes",
        options: [
          {
            type: ApplicationCommandOptionTypes.STRING,
            name: "message",
            description: "Le message à envoyer",
            required: true,
          },
        ],
      } as ApplicationCommandSubCommandData,
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "end",
        description: "Met fin à l'événement multijoueurs",
      } as ApplicationCommandSubCommandData,
    ],
  };

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    await commandInteraction.reply({
      content: "Je ne sais pas encore faire ça",
      ephemeral: true,
    });
    return { cmd: "EventCommand", result: "Commande non implémentée" };
  }
}

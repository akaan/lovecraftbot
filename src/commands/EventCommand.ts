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
    const subCommandGroup =
      commandInteraction.options.getSubcommandGroup(false);
    const subCommand = commandInteraction.options.getSubcommand();

    await commandInteraction.reply({
      content: "Je ne sais pas encore faire ça",
      ephemeral: true,
    });
    return this.commandResult("Commande non implémentée", {
      subCommandGroup,
      subCommand,
    });
  }

  /**
   * Permet de construire le résultat de la commande.
   *
   * @param result Le résultat de la commande
   * @param meta Les données supplémentaires à adjoindre
   * @returns Un résultat de commande complet
   */
  private commandResult(
    result: string,
    meta?: Omit<IApplicationCommandResult, "cmd" | "result">
  ) {
    return { cmd: "EventCommand", result, ...meta };
  }
}

import {
  ApplicationCommandSubCommandData,
  CommandInteraction,
  Channel,
} from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import {
  ApplicationCommandAccess,
  IApplicationCommand,
  IApplicationCommandResult,
} from "../interfaces";
import { MassMultiplayerEventService } from "../services/MassMultiplayerEventService";

/** Commande pour les joueurs d'une partie du Dévoreur de Toute Chose */
export class BlobCommand implements IApplicationCommand {
  @Inject massMultiplayerEventService!: MassMultiplayerEventService;

  commandAccess = ApplicationCommandAccess.GUILD;

  commandData = {
    name: "blob",
    description: `Commandes joueurs pour une partie du Dévoreur de Tout Chose`,
    options: [
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "i",
        description: "Placer un nombre d'indices sur l'Acte 1",
        options: [
          {
            type: ApplicationCommandOptionTypes.INTEGER,
            name: "indices",
            description: "Nombre d'indices",
            required: true,
          },
        ],
      } as ApplicationCommandSubCommandData,
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "cm-gain",
        description: "Indiquer que des contre-mesures ont été gagnées",
        options: [
          {
            type: ApplicationCommandOptionTypes.INTEGER,
            name: "contre-mesures",
            description: "Nombre de contre-mesures gagnées",
            required: true,
          },
        ],
      } as ApplicationCommandSubCommandData,
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "cm-depense",
        description: "Indiquer que des contre-mesures ont été dépensées",
        options: [
          {
            type: ApplicationCommandOptionTypes.INTEGER,
            name: "contre-mesures",
            description: "Nombre de contre-mesures dépensées",
            required: true,
          },
        ],
      } as ApplicationCommandSubCommandData,
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "d",
        description: "Infliger un nombre de dégâts au Dévoreur",
        options: [
          {
            type: ApplicationCommandOptionTypes.INTEGER,
            name: "dégâts",
            description: "Nombre de dégâts",
            required: true,
          },
        ],
      } as ApplicationCommandSubCommandData,
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "histoire",
        description: "Obtenir un rappel de l'histoire sélectionnée",
      } as ApplicationCommandSubCommandData,
    ],
  };

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    if (!commandInteraction.guild) {
      await commandInteraction.reply({
        content: "Désolé, cette commande doit être exécutée sur un serveur",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible d'exécuter cette commande hors serveur"
      );
    }

    const channel = commandInteraction.channel;
    if (
      !channel ||
      !this.massMultiplayerEventService.isGroupChannel(
        commandInteraction.guild,
        channel as Channel
      )
    ) {
      await commandInteraction.reply({
        content:
          "Désolé, mais il faut être dans l'un des canaux de l'événement pour lancer cette commande",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible d'exécuter cette commande hors d'un canal dédié à un événement"
      );
    }

    const subCommand = commandInteraction.options.getSubcommand();

    await commandInteraction.reply({
      content: "Je ne sais pas encore faire ça",
      ephemeral: true,
    });
    return this.commandResult("Commande non implémentée", {
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
    return { cmd: "AdminBlobCommand", result, ...meta };
  }
}

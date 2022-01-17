import {
  ApplicationCommandSubCommandData,
  CommandInteraction,
  Channel,
  Guild,
  TextChannel,
} from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import {
  ApplicationCommandAccess,
  IApplicationCommand,
  IApplicationCommandResult,
} from "../interfaces";
import { BlobGameService } from "../services/BlobGameService";
import { MassMultiplayerEventService } from "../services/MassMultiplayerEventService";

/** Commande pour les joueurs d'une partie du Dévoreur de Toute Chose */
export class BlobCommand implements IApplicationCommand {
  @Inject massMultiplayerEventService!: MassMultiplayerEventService;
  @Inject blobGameService!: BlobGameService;

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

    if (!this.blobGameService.isGameRunning(commandInteraction.guild)) {
      await commandInteraction.reply({
        content:
          "Désolé, il n'y a pas de partie du Dévoreur de Toute Chose en cours",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible d'exécuter cette commande sans partie en cours"
      );
    }
    const subCommand = commandInteraction.options.getSubcommand();

    if (
      subCommand !== "histoire" &&
      !this.massMultiplayerEventService.isTimerRunning(commandInteraction.guild)
    ) {
      await commandInteraction.reply({
        content: "Désolé, il faut attendre que la minuterie soit active",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible d'exécuter cette commande sans minuterie active"
      );
    }

    if (subCommand === "i") {
      return this.placeCluesOnAct1(
        commandInteraction,
        commandInteraction.guild,
        // On a vérifié via massMultiplayerEventService#isGroupChannel
        channel as TextChannel
      );
    }

    await commandInteraction.reply({
      content: "Je ne sais pas encore faire ça",
      ephemeral: true,
    });
    return this.commandResult("Commande non implémentée", {
      subCommand,
    });
  }

  /**
   * Traite le cas de la sous-commande de pose d'indices sur l'Acte 1.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  public async placeCluesOnAct1(
    commandInteraction: CommandInteraction,
    guild: Guild,
    channel: TextChannel
  ): Promise<IApplicationCommandResult> {
    const numberOfClues = commandInteraction.options.getInteger("indices");
    if (!numberOfClues) {
      await commandInteraction.reply({
        content: "Ooops, je n'ai pas le nombre d'indices",
        ephemeral: true,
      });
      return this.commandResult("Impossible sans nombre d'indices");
    }

    if (numberOfClues > 3) {
      await commandInteraction.reply({
        content:
          "Désolé, il n'est pas possible de poser plus de 3 indices à la fois",
        ephemeral: true,
      });
      return this.commandResult("Impossible, trop d'indices");
    }

    await this.blobGameService.placeCluesOnAct1(guild, channel, numberOfClues);
    await commandInteraction.reply({
      content: `${numberOfClues} indice(s) posé(s) sur l'Acte 1`,
      ephemeral: true,
    });
    return this.commandResult("Indices posés sur l'Acte 1");
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

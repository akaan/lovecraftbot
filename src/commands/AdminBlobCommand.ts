import {
  ApplicationCommandSubCommandData,
  CommandInteraction,
  Guild,
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

/** Commande de gestion d'une partie du Dévoreur de Toute Chose */
export class AdminBlobCommand implements IApplicationCommand {
  @Inject blobGameService!: BlobGameService;
  @Inject massMultiplayerEventService!: MassMultiplayerEventService;

  commandAccess = ApplicationCommandAccess.ADMIN;

  commandData = {
    name: "ablob",
    description: `Commandes de gestion d'une partie du Dévoreur de Tout Chose`,
    options: [
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "start",
        description: "Démarre une partie du Dévoreur de Toute Chose",
        options: [
          {
            type: ApplicationCommandOptionTypes.INTEGER,
            name: "joueurs",
            description: "Nombre de joueurs",
            required: true,
          },
        ],
      } as ApplicationCommandSubCommandData,
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "i",
        description: "Corrige le nombre d'indices sur l'Acte 1",
        options: [
          {
            type: ApplicationCommandOptionTypes.INTEGER,
            name: "indices",
            description: "Nombre d'indices sur l'Acte 1",
            required: true,
          },
        ],
      } as ApplicationCommandSubCommandData,
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "cm",
        description: "Corrige le nombre de contre-mesures disponibles",
        options: [
          {
            type: ApplicationCommandOptionTypes.INTEGER,
            name: "contre-mesures",
            description: "Nombre de contre-mesures",
            required: true,
          },
        ],
      } as ApplicationCommandSubCommandData,
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "d",
        description: "Corrige le nombre de dégâts sur le Dévoreur",
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
        name: "end",
        description: "Met fin à la partie du Dévoreur de Toute Chose",
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

    const subCommand = commandInteraction.options.getSubcommand();

    if (subCommand === "start") {
      return this.startNewGame(commandInteraction, commandInteraction.guild);
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
   * Traite le cas de la sous-commande de démarage d'une nouvelle partie.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  public async startNewGame(
    commandInteraction: CommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    if (this.blobGameService.isGameRunning(guild)) {
      await commandInteraction.reply({
        content: "Impossible, il y a déjà une partie en cours",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de démarrer une partie car il y en a déjà une en cours"
      );
    }

    if (!this.massMultiplayerEventService.isEventRunning(guild))
      return this.noEvent(commandInteraction, "start");

    const numberOfPlayers = commandInteraction.options.getInteger("joueurs");
    if (!numberOfPlayers) {
      await commandInteraction.reply({
        content: "Ooops, je n'ai pas le nombre de minutes",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de démarrer une minuterie sans la nombre de minutes"
      );
    }

    await this.blobGameService.startNewGame(guild, numberOfPlayers);
    await commandInteraction.reply({
      content: "Nouvelle partie du Dévoreur de Toute Chose démarrée !",
      ephemeral: true,
    });
    return this.commandResult("Partie du Dévoreur démarrée");
  }

  /**
   * Répond qu'il n'y a pas d'événement en cours.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async noEvent(
    commandInteraction: CommandInteraction,
    subCommand: string
  ): Promise<IApplicationCommandResult> {
    await commandInteraction.reply({
      content: "Impossible, il n'y a pas d'événement en cours",
      ephemeral: true,
    });
    return this.commandResult("Impossible : pas d'événement en cours", {
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
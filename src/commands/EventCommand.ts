import {
  ApplicationCommandSubCommandData,
  ApplicationCommandSubGroupData,
  CategoryChannel,
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
import { MassMultiplayerEventService } from "../services/MassMultiplayerEventService";

/** Commande de gestion des événements multijoueurs */
export class EventCommand implements IApplicationCommand {
  @Inject massMultiplayerEventService!: MassMultiplayerEventService;

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
            type: ApplicationCommandOptionTypes.CHANNEL,
            name: "catégorie",
            description:
              "La catégorie de canaux dans laquelle créer les canaux",
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
    if (!commandInteraction.guild) {
      await commandInteraction.reply({
        content: "Désolé, cette commande doit être exécutée sur un serveur",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible d'exécuter cette commande hors serveur"
      );
    }

    const subCommandGroup =
      commandInteraction.options.getSubcommandGroup(false);
    const subCommand = commandInteraction.options.getSubcommand();

    if (subCommandGroup === null && subCommand === "start") {
      return this.startEvent(commandInteraction, commandInteraction.guild);
    }

    if (subCommandGroup === null && subCommand === "msg") {
      return this.broadcastMessage(
        commandInteraction,
        commandInteraction.guild
      );
    }

    if (subCommandGroup === null && subCommand === "end") {
      return this.endEvent(commandInteraction, commandInteraction.guild);
    }

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
   * Traite le cas de la sous-commande de démarrage d'un événement multijoueurs.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async startEvent(
    commandInteraction: CommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    if (this.massMultiplayerEventService.runningEvent(guild)) {
      await commandInteraction.reply({
        content: "Impossible, il y a déjà un événement en cours",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de démarrer l'événement : il y en a déjà un en cours"
      );
    }

    const numberOfGroups = commandInteraction.options.getInteger("groupes");
    if (!numberOfGroups) {
      await commandInteraction.reply({
        content: "Ooops, je n'ai pas le nombre de groupes",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de démarrer l'événement sans le nombre de groupes"
      );
    }

    const categoryChannel = commandInteraction.options.getChannel("catégorie");
    if (!categoryChannel || !(categoryChannel.type === "GUILD_CATEGORY")) {
      await commandInteraction.reply({
        content: "Impossible sans précisr une catégorie de canaux valide",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de démarrer l'événement sans une catégorie de canaux"
      );
    }

    await this.massMultiplayerEventService.startEvent(
      guild,
      categoryChannel as CategoryChannel,
      numberOfGroups
    );

    await commandInteraction.reply({
      content: "Evénement démarré !",
      ephemeral: true,
    });
    return this.commandResult("Evénement démarré");
  }

  /**
   * Traite le cas de la sous-commande d'envoi de message à tous les groupes
   * d'un événement multijoueurs.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async broadcastMessage(
    commandInteraction: CommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    if (!this.massMultiplayerEventService.runningEvent(guild)) {
      await commandInteraction.reply({
        content: "Impossible, il n'y a pas d'événement en cours",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible d'envoyer un message : il n'y a pas d'événement en cours"
      );
    }

    const message = commandInteraction.options.getString("message");
    if (!message) {
      await commandInteraction.reply({
        content: "Ooops, je n'ai pas le message à envoyer",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible d'envoyer un message sans le message"
      );
    }

    await this.massMultiplayerEventService.broadcastMessage(guild, {
      content: message,
    });

    await commandInteraction.reply({
      content: "Message envoyé !",
      ephemeral: true,
    });
    return this.commandResult("Message envoyé");
  }

  /**
   * Traite le cas de la sous-commande de fin d'un événement multijoueurs.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async endEvent(
    commandInteraction: CommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    if (!this.massMultiplayerEventService.runningEvent(guild)) {
      await commandInteraction.reply({
        content: "Impossible, il n'y a pas d'événement en cours",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de mettre fin l'événement : il n'y en a pas en cours"
      );
    }

    await this.massMultiplayerEventService.endEvent(guild);

    await commandInteraction.reply({
      content: "Evénement terminé !",
      ephemeral: true,
    });
    return this.commandResult("Evénement terminé");
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

import {
  ApplicationCommand,
  ApplicationCommandPermissionData,
  Client,
  CommandInteraction,
  Guild,
  GuildApplicationCommandPermissionData,
  Role,
} from "discord.js";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";
import * as ApplicationCommands from "../commands";
import {
  IApplicationCommand,
  IApplicationCommandResult,
  ApplicationCommandConstructor,
} from "../interfaces";

import { EnvService } from "./EnvService";
import { LoggerService } from "./LoggerService";

/**
 * Type représentant un dictionnaire de définitions de commandes d'application
 */
type ApplicationCommandsDictionary = {
  [key: string]: ApplicationCommandConstructor;
};

/** Ensembles des définitions  de commandes d'application importées */
const AvailableApplicationCommands =
  ApplicationCommands as unknown as ApplicationCommandsDictionary;

@Singleton
@OnlyInstantiableByContainer
/**
 * Service gérant et exécutant les commandes d'application.
 */
export class ApplicationCommandManager extends BaseService {
  /** Etiquette utilisée pour les logs de ce service */
  private static LOG_LABEL = "ApplicationCommandManager";

  @Inject private envService!: EnvService;
  @Inject logger!: LoggerService;

  /** Liste des commandes d'application exécutables */
  private applicationCommands: IApplicationCommand[] = [];

  public async init(client: Client): Promise<void> {
    await super.init(client);
    this.loadApplicationCommands(AvailableApplicationCommands);
  }

  /**
   * Gère une interaction en cherchant s'il existe une commande d'application
   * associée et en l'exécutant si c'est le cas.
   *
   * @param commandInteraction Interation déclenchée par l'utilisateur
   * @returns Promesse d'un résultat de commande d'application
   */
  public handleCommandInteraction(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    const slashCommand = this.applicationCommands.find(
      (sc) => sc.name === commandInteraction.commandName
    );
    if (slashCommand) {
      return slashCommand.execute(commandInteraction);
    } else {
      return Promise.resolve({
        cmd: commandInteraction.commandName,
        result: `Commande "${commandInteraction.commandName}" inconnue`,
      });
    }
  }

  /**
   * Instancie et référence les commandes d'application depuis leurs
   * définitions.
   *
   * @param applicationCommands Dictionnaire des définitions de
   *                            commandes d'application
   */
  private loadApplicationCommands(
    applicationCommands: ApplicationCommandsDictionary
  ): void {
    Object.values(applicationCommands).forEach(
      (applicationCommandConstructor) => {
        const applicationCommandInstance: IApplicationCommand =
          new applicationCommandConstructor();
        if (applicationCommandInstance.isGuildCommand)
          applicationCommandInstance.defaultPermission = false;
        this.applicationCommands.push(applicationCommandInstance);
      }
    );
  }

  /**
   * Renvoie les commandes d'application référencées au niveau serveur
   *
   * @returns Les commandes d'application de niveau serveur
   */
  private getGuildApplicationCommands(): IApplicationCommand[] {
    return this.applicationCommands.filter((sc) => sc.isGuildCommand);
  }

  /**
   * Renvoie les commandes d'applications référencées au niveau global
   *
   * @returns Les commandes d'application globales
   */
  public getGlobalApplicationCommands(): IApplicationCommand[] {
    return this.applicationCommands.filter((sc) => !sc.isGuildCommand);
  }

  /**
   * Référence auprès de Discord l'ensemble des commandes d'application
   *
   * @returns Une promesse résolue une fois les commandes référencées
   */
  public async registerApplicationCommands(): Promise<void> {
    await this.registerGlobalApplicationCommands();
    await this.registerGuildApplicationCommands();
  }

  /**
   * Référence auprès de Discord les commandes d'application globales
   *
   * @returns Une promesse résolue une fois les commandes référencées
   */
  private async registerGlobalApplicationCommands(): Promise<void> {
    if (this.client && this.client.application) {
      try {
        this.logger.info(
          ApplicationCommandManager.LOG_LABEL,
          `Enregistrement des commandes d'application globales...`
        );
        await this.client.application.commands.set(
          this.getGlobalApplicationCommands()
        );
        this.logger.info(
          ApplicationCommandManager.LOG_LABEL,
          `Commandes d'application globales enregistrées`
        );
      } catch (err) {
        this.logger.error(
          ApplicationCommandManager.LOG_LABEL,
          `Erreur à l'enregistrement des commandes d'application globales`,
          { error: err }
        );
      }
    }
  }

  /**
   * Référence auprès de Discord les commandes d'application de niveau serveur
   *
   * @returns Une promesse résolue une fois les commandes référencées
   */
  private async registerGuildApplicationCommands(): Promise<void> {
    if (this.client) {
      const guilds = this.client.guilds.cache.filter(
        filterGuilds(this.envService.testServerId)
      );
      const registers = guilds.map(async (guild) => {
        this.logger.info(
          ApplicationCommandManager.LOG_LABEL,
          `Enregistrement des commandes d'application niveau serveur pour ${guild.name}...`
        );
        await guild.commands.set(this.getGuildApplicationCommands());
        this.logger.info(
          ApplicationCommandManager.LOG_LABEL,
          `Commandes d'application niveau serveur enregistrées pour ${guild.name}`
        );
      });
      await Promise.all(registers);
    }
  }

  /**
   * Référence auprès de Discord les permissions associées aux commandes
   * d'application de niveau serveur
   *
   * @returns Une promesse résolue une fois les commandes référencées
   */
  public async setGuildApplicationCommandsPermissions(): Promise<void> {
    if (!this.client) {
      return;
    }

    const botAdminRoleName = this.envService.botAdminRoleName;
    if (botAdminRoleName) {
      const guildApplicationCommandNames =
        this.getGuildApplicationCommands().map((c) => c.name);

      try {
        const setPermissions = this.client.guilds.cache
          .filter(filterGuilds(this.envService.testServerId))
          .map(async (guild) => {
            this.logger.info(
              ApplicationCommandManager.LOG_LABEL,
              `Mise en place des permissions pour les commandes d'application niveau serveur de ${guild.name}`
            );
            const result = await allowCommandsForRoleName(
              guild,
              guildApplicationCommandNames,
              botAdminRoleName
            );
            this.logger.info(
              ApplicationCommandManager.LOG_LABEL,
              `Permissions mises en place pour les commandes d'application niveau serveur de ${guild.name}`
            );
            return result;
          });
        await Promise.all(setPermissions);
      } catch (err) {
        this.logger.error(
          ApplicationCommandManager.LOG_LABEL,
          `Erreur à la mise en place des permissions pour les commandes d'application niveau serveur`,
          { error: err }
        );
      }
    }
  }

  /**
   * Déréférence les commandes d'application auprès de Discord.
   *
   * @returns Une promesse résolue une fois le déférencement effectué
   */
  public async unregisterApplicationCommands(): Promise<void> {
    if (!this.client) return;

    try {
      if (this.client.application) {
        await this.client.application.commands.set([]);
      }
      const unregisters = this.client.guilds.cache.map(async (guild) => {
        await guild.commands.set([]);
        await guild.commands.permissions.set({ fullPermissions: [] });
      });
      await Promise.all(unregisters);
    } catch (err) {
      this.logger.error(
        ApplicationCommandManager.LOG_LABEL,
        "Erreur au désenregistrement des commandes d'application",
        { error: err }
      );
    }
  }
}

/**
 * Construit un filtre qui sera soit un passe-plat soit un filtre qui ne laisse
 * passer que le serveur dont l'identifiant est celui fournit.
 * Utile pour filtrer sur un serveur de test si un identifiant de serveur de
 * test est présent.
 *
 * @param maybeGuildId Un identifiant de serveur ou rien s'il ne faut pas filtrer
 * @returns Un filtre à appliquer sur une collection de serveurs
 */
function filterGuilds(
  maybeGuildId: string | undefined
): (guild: Guild) => boolean {
  if (maybeGuildId) {
    return (guild: Guild) => guild.id === maybeGuildId;
  }
  return (_guild: Guild) => true;
}

/**
 * Construit une permission de type rôle.
 *
 * @param role Le rôle concerné par la permission
 * @returns Le descriptif d'une permission basée sur le rôle
 */
function createRolePermission(role: Role): ApplicationCommandPermissionData {
  return {
    id: role.id,
    type: "ROLE",
    permission: true,
  };
}

/**
 * Construit une permission pour une commande d'application.
 *
 * @param command La commande concernée par la permission
 * @param permissions Les permissions à associer à la commande
 * @returns Une descriptif de permission pour une commande
 */
function createCommandPermission(
  command: ApplicationCommand,
  permissions: ApplicationCommandPermissionData[]
): GuildApplicationCommandPermissionData {
  return {
    id: command.id,
    permissions,
  };
}

/**
 * Référence auprès de Discord (en annule et remplace), pour un serveur donné,
 * des permissions pour une liste de commandes donnée et pour le rôlé donné.
 *
 * @param guild Le serveur sur lequel positionner la permission
 * @param commandNames Les noms des commandes sur lesquelles appliquer la permission
 * @param roleName Le nom du rôle auquel restreindre les commandes
 * @returns Une promesse résolue une fois les permissions référencées
 */
async function allowCommandsForRoleName(
  guild: Guild,
  commandNames: string[],
  roleName: string
): Promise<void> {
  const role = guild.roles.cache.find((r) => r.name === roleName);
  if (role) {
    // Il faut utiliser `fetch` car potentiellement les commandes viennent
    // tout juste d'être créées et ne sont pas dans le cache.
    const commands = (await guild.commands.fetch())
      .filter((c) => commandNames.includes(c.name))
      .map((c) => c);

    if (commands.length > 0) {
      const fullPermissions = commands.map((c) =>
        createCommandPermission(c, [createRolePermission(role)])
      );
      await guild.commands.permissions.set({ fullPermissions });
    }
  }
}

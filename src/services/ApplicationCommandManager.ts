import {
  ApplicationCommand,
  ApplicationCommandManager as GlobalApplicationCommandManager,
  ApplicationCommandPermissionData,
  ChatInputApplicationCommandData,
  Client,
  Collection,
  CommandInteraction,
  Guild,
  GuildApplicationCommandManager,
  GuildApplicationCommandPermissionData,
  GuildResolvable,
  Role,
} from "discord.js";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";
import * as ApplicationCommands from "../commands";
import {
  IApplicationCommand,
  IApplicationCommandResult,
  ApplicationCommandConstructor,
  ApplicationCommandAccess,
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

    void this.deployGlobalApplicationCommands();
    client.guilds.cache.forEach(
      (guild) => void this.deployGuildApplicationCommands(guild)
    );
    client.on("guildCreate", (guild) => {
      void this.deployGuildApplicationCommands(guild);
    });
  }

  /**
   * Gère une interaction en cherchant s'il existe une commande d'application
   * associée et en l'exécutant si c'est le cas.
   *
   * @param commandInteraction Interation déclenchée par l'utilisateur
   * @returns Promesse d'un résultat de commande d'application
   */
  public async handleCommandInteraction(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    const command = this.applicationCommands.find(
      (sc) => sc.commandData.name === commandInteraction.commandName
    );
    if (command) {
      return command.execute(commandInteraction);
    } else {
      await commandInteraction.reply({
        content: "Désolé, je ne sais pas traiter cette commande",
        ephemeral: true,
      });
      return Promise.resolve({
        cmd: commandInteraction.commandName,
        result: `Commande "${commandInteraction.commandName}" inconnue`,
      });
    }
  }

  /**
   * Renvoie les commandes d'application référencées au niveau serveur
   *
   * @returns Les commandes d'application de niveau serveur
   */
  public getGuildApplicationCommands(): IApplicationCommand[] {
    return this.applicationCommands.filter(
      (c) => c.commandAccess === ApplicationCommandAccess.GUILD
    );
  }

  /**
   * Renvoie les commandes d'application référencées au niveau serveur
   *
   * @returns Les commandes d'application de niveau serveur
   */
  private getAdminApplicationCommands(): IApplicationCommand[] {
    return this.applicationCommands.filter(
      (c) => c.commandAccess === ApplicationCommandAccess.ADMIN
    );
  }

  /**
   * Renvoie les commandes d'applications référencées au niveau global
   *
   * @returns Les commandes d'application globales
   */
  public getGlobalApplicationCommands(): IApplicationCommand[] {
    return this.applicationCommands.filter(
      (c) => c.commandAccess === ApplicationCommandAccess.GLOBAL
    );
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

        // En mode développement les commandes globales sont ramenées au niveau
        // serveur.
        if (
          this.envService.mode === "development" &&
          applicationCommandInstance.commandAccess ===
            ApplicationCommandAccess.GLOBAL
        ) {
          applicationCommandInstance.commandAccess =
            ApplicationCommandAccess.GUILD;
        }

        if (
          applicationCommandInstance.commandAccess ===
          ApplicationCommandAccess.ADMIN
        ) {
          applicationCommandInstance.commandData.defaultPermission = false;
        } else {
          applicationCommandInstance.commandData.defaultPermission = true;
        }
        this.applicationCommands.push(applicationCommandInstance);
      }
    );
  }

  /**
   * Déploie les commandes d'application globales en :
   * - Supprimant les commandes déployées non gérées par le bot
   * - Déployant les commandes gérées par le bot mais non présentes sur Discord
   * - Mettant à jour les commandes qui diffèrent
   *
   * @returns Une promesse résolue une fois le traitement terminé
   */
  private async deployGlobalApplicationCommands(): Promise<void> {
    try {
      if (this.client && this.client.application) {
        const commandManager = this.client.application.commands;

        const deployedCommands = await this.client.application.commands.fetch();
        const botCommands = this.getGlobalApplicationCommands().map(
          (c) => c.commandData
        );

        await this.deleteObsoleteCommands(deployedCommands, botCommands);
        await this.createNewCommands(
          deployedCommands,
          botCommands,
          commandManager
        );
        await this.updateCommands(deployedCommands, botCommands);
      }
    } catch (error) {
      this.logger.error(
        ApplicationCommandManager.LOG_LABEL,
        `Erreur au déploiement des commandes d'application globales`,
        { error }
      );
    }
  }

  /**
   * Déploie les commandes d'application d'un serveur en :
   * - Supprimant les commandes déployées non gérées par le bot
   * - Déployant les commandes gérées par le bot mais non présentes sur Discord
   * - Mettant à jour les commandes qui diffèrent
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois le traitement terminé
   */
  private async deployGuildApplicationCommands(guild: Guild): Promise<void> {
    try {
      const commandManager = guild.commands;
      const deployedCommands = await commandManager.fetch();
      const botCommands = [
        ...this.getGuildApplicationCommands(),
        ...this.getAdminApplicationCommands(),
      ].map((c) => c.commandData);

      await this.deleteObsoleteCommands(deployedCommands, botCommands);
      await this.createNewCommands(
        deployedCommands,
        botCommands,
        commandManager
      );
      await this.updateCommands(deployedCommands, botCommands);
      await this.setAdminApplicationCommandsPermissions(guild);
    } catch (error) {
      this.logger.error(
        ApplicationCommandManager.LOG_LABEL,
        `Erreur au déploiement des commandes d'application niveau serveur`,
        { error }
      );
    }
  }

  /**
   * Supprime les commandes déployées mais non gérées par le bot.
   *
   * @param deployedCommands Les commandes déployées sur Discord
   * @param botCommands Les commandes gérées par le bot
   * @returns Une promesse résolue une fois le traitement terminé
   */
  private async deleteObsoleteCommands(
    deployedCommands: Collection<
      string,
      ApplicationCommand<{ guild: GuildResolvable }>
    >,
    botCommands: ChatInputApplicationCommandData[]
  ): Promise<void> {
    const deployedCommandsToDelete = deployedCommands.filter(
      (deployedCommand) =>
        !botCommands.some(
          (botCommand) => botCommand.name === deployedCommand.name
        )
    );
    const deletions = deployedCommandsToDelete.map(
      async (deployedCommandToDelete) => {
        const deletion = await deployedCommandToDelete.delete();
        this.logger.warn(
          ApplicationCommandManager.LOG_LABEL,
          `Commande "${deployedCommandToDelete.name}" supprimée de Discord${
            deployedCommandToDelete.guild
              ? ` pour le serveur ${deployedCommandToDelete.guild.name}`
              : ""
          }`
        );
        return deletion;
      }
    );
    await Promise.all(deletions);
  }

  /**
   * Déploie sur Discord les commandes gérées par le bot mais non déployées.
   *
   * @param deployedCommands Les commandes déployées sur Discord
   * @param botCommands Les commandes gérées par le bot
   * @param commandManager Le gestionnaire de commandes (global ou niveau
   *                       serveur)
   * @returns Une promesse résolue une fois le traitement terminé
   */
  private async createNewCommands(
    deployedCommands: Collection<
      string,
      ApplicationCommand<{ guild: GuildResolvable }>
    >,
    botCommands: ChatInputApplicationCommandData[],
    commandManager:
      | GlobalApplicationCommandManager
      | GuildApplicationCommandManager
  ): Promise<void> {
    const guildName =
      commandManager instanceof GuildApplicationCommandManager
        ? commandManager.guild.name
        : undefined;

    const newCommands = botCommands.filter(
      (botCommand) =>
        !deployedCommands.some(
          (deployedCommand) => deployedCommand.name === botCommand.name
        )
    );
    const deploys = newCommands.map(async (newCommand) => {
      const deploy = await commandManager.create(newCommand);
      this.logger.warn(
        ApplicationCommandManager.LOG_LABEL,
        `Commande "${newCommand.name}" déployée sur Discord${
          guildName ? ` pour le serveur ${guildName}` : ""
        }`
      );
      return deploy;
    });
    await Promise.all(deploys);
  }

  /**
   * Met à jour sur Discord les commandes qui diffèrent entre ce qui est déployé
   * et les commandes du bot.
   *
   * @param deployedCommands Les commandes déployées sur Discord
   * @param botCommands Les commandes gérées par le bot
   * @returns Une promesse résolue uen fois le traitement terminé
   */
  private async updateCommands(
    deployedCommands: Collection<
      string,
      ApplicationCommand<{ guild: GuildResolvable }>
    >,
    botCommands: ChatInputApplicationCommandData[]
  ): Promise<void> {
    const edits = botCommands.map(async (botCommand) => {
      const deployedCommand = deployedCommands.find(
        (c) => c.name === botCommand.name
      );
      if (deployedCommand && !deployedCommand.equals(botCommand)) {
        const edit = deployedCommand.edit(botCommand);
        this.logger.warn(
          ApplicationCommandManager.LOG_LABEL,
          `Mise à jour de la commande "${botCommand.name}" sur Discord${
            deployedCommand.guild
              ? ` pour le serveur ${deployedCommand.guild.name}`
              : ""
          }`
        );
        return edit;
      }
    });
    await Promise.all(edits);
  }

  /**
   * Référence auprès de Discord les permissions associées aux commandes
   * d'application de niveau serveur
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois les permissions mises en place
   */
  private async setAdminApplicationCommandsPermissions(
    guild: Guild
  ): Promise<void> {
    const botAdminRoleName = this.envService.botAdminRoleName;
    if (!botAdminRoleName) {
      this.logger.warn(
        ApplicationCommandManager.LOG_LABEL,
        `Pas de rôle d'adminsitration du bot configuré`
      );
      return;
    }

    try {
      const botAdminRole = guild.roles.cache.find(
        (r) => r.name === botAdminRoleName
      );
      if (!botAdminRole) {
        this.logger.warn(
          ApplicationCommandManager.LOG_LABEL,
          `Pas de rôle "${botAdminRoleName}" sur le serveur ${guild.name}`
        );
        return;
      }

      const commands = await guild.commands.fetch();
      const adminCommandNames = this.getAdminApplicationCommands().map(
        (c) => c.commandData.name
      );
      const adminCommands = commands.filter((c) =>
        adminCommandNames.includes(c.name)
      );
      if (commands.size > 0) {
        const fullPermissions = adminCommands.map((c) =>
          createCommandPermission(c, [createRolePermission(botAdminRole)])
        );
        await guild.commands.permissions.set({ fullPermissions });
        this.logger.warn(
          ApplicationCommandManager.LOG_LABEL,
          `Permissions de commandes d'application niveau serveur mises en place sur le serveur ${guild.name}`
        );
      }
    } catch (err) {
      this.logger.error(
        ApplicationCommandManager.LOG_LABEL,
        `Erreur à la mise en place des permissions pour les commandes d'application niveau serveur sur ${guild.name}`,
        { error: err }
      );
    }
  }
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

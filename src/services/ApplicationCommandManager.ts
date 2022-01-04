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

function filterGuilds(
  maybeGuildId: string | undefined
): (guild: Guild) => boolean {
  if (maybeGuildId) {
    return (guild: Guild) => guild.id === maybeGuildId;
  }
  return (_guild: Guild) => true;
}

type ApplicationCommandsDictionary = {
  [key: string]: ApplicationCommandConstructor;
};
const AvailableApplicationCommands =
  ApplicationCommands as unknown as ApplicationCommandsDictionary;

function createRolePermission(role: Role): ApplicationCommandPermissionData {
  return {
    id: role.id,
    type: "ROLE",
    permission: true,
  };
}

function createCommandPermission(
  command: ApplicationCommand,
  permissions: ApplicationCommandPermissionData[]
): GuildApplicationCommandPermissionData {
  return {
    id: command.id,
    permissions,
  };
}

async function allowCommandsForRoleName(
  guild: Guild,
  commandNames: string[],
  roleName: string
): Promise<void> {
  const role = guild.roles.cache.find((r) => r.name === roleName);
  if (role) {
    // We need fetch because we just created them
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

@Singleton
@OnlyInstantiableByContainer
export class ApplicationCommandManager extends BaseService {
  private static LOG_LABEL = "ApplicationCommandManager";

  @Inject private envService!: EnvService;
  @Inject logger!: LoggerService;

  private applicationCommands: IApplicationCommand[] = [];

  public async init(client: Client): Promise<void> {
    await super.init(client);
    this.loadApplicationCommands(AvailableApplicationCommands);
  }

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

  private getGuildApplicationCommands(): IApplicationCommand[] {
    return this.applicationCommands.filter((sc) => sc.isGuildCommand);
  }

  public getGlobalApplicationCommands(): IApplicationCommand[] {
    return this.applicationCommands.filter((sc) => !sc.isGuildCommand);
  }

  public async registerApplicationCommands(): Promise<void> {
    await this.registerGlobalApplicationCommands();
    await this.registerGuildApplicationCommands();
  }

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

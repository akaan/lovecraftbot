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
        message: `Unknown command "${commandInteraction.commandName}"`,
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
        this.logger.log(
          `[ApplicationCommandManager] Registering global application commands...`
        );
        await this.client.application.commands.set(
          this.getGlobalApplicationCommands()
        );
        this.logger.log(
          `[ApplicationCommandManager] Registered global application commands`
        );
      } catch (err) {
        this.logger.error(
          `[ApplicationCommandManager] Error while registering global application commands`,
          err
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
        this.logger.log(
          `[ApplicationCommandManager] Registering guild application commands for guild ${guild.name}...`
        );
        await guild.commands.set(this.getGuildApplicationCommands());
        this.logger.log(
          `[ApplicationCommandManager] Registered guild application commands for guild ${guild.name}`
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
        await Promise.all(
          this.client.guilds.cache
            .filter(filterGuilds(this.envService.testServerId))
            .map((guild) => {
              this.logger.log(
                `[ApplicationCommandManager] Setting permissions for guild application commands in guild ${guild.name}`
              );
              return allowCommandsForRoleName(
                guild,
                guildApplicationCommandNames,
                botAdminRoleName
              ).then(() =>
                this.logger.log(
                  `[ApplicationCommandManager] Permissions set for guild application commands in guild ${guild.name}`
                )
              );
            })
        );
      } catch (err) {
        this.logger.error(
          "[ApplicationCommandManager] Error while setting permissions on admin commands",
          err
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
      await Promise.all(
        this.client.guilds.cache.map((guild) =>
          guild.commands
            .set([])
            .then(() => guild.commands.permissions.set({ fullPermissions: [] }))
        )
      );
    } catch (err) {
      this.logger.error(
        "[ApplicationCommandManager] Error while cleaning up before registering slash commands",
        err
      );
    }
  }
}

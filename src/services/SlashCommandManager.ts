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
import * as SlashCommands from "../commands/slashCommands";
import {
  ISlashCommand,
  ISlashCommandResult,
  SlashCommandConstructor,
} from "../interfaces";

import { EnvService } from "./EnvService";
import { LoggerService } from "./LoggerService";

type SlashCommandsDictionary = { [key: string]: SlashCommandConstructor };
const AvailableSlashCommands =
  SlashCommands as unknown as SlashCommandsDictionary;

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
export class SlashCommandManager extends BaseService {
  @Inject private envService!: EnvService;
  @Inject logger!: LoggerService;

  private slashCommands: ISlashCommand[] = [];

  public async init(client: Client): Promise<void> {
    await super.init(client);

    this.loadSlashCommands(AvailableSlashCommands);
    this.registerSlashCommands()
      .then(() => this.logger.log("Slash commands registered"))
      .then(() => this.setSlashCommandPermissions())
      .catch((err) =>
        this.logger.error("Error while registering commands", err)
      );
  }

  public async shutdown(): Promise<void> {
    await this.unregisterSlashCommands()
      .then(() => this.logger.log("Slash commands unregistered"))
      .catch((err) =>
        this.logger.error("rror while unregistering slash commands", err)
      );
  }

  public handleCommandInteraction(
    commandInteraction: CommandInteraction
  ): Promise<ISlashCommandResult> {
    const slashCommand = this.slashCommands.find(
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

  private loadSlashCommands(slashCommands: SlashCommandsDictionary): void {
    Object.values(slashCommands).forEach((slashCommandConstructor) => {
      const slashCommandInstance: ISlashCommand = new slashCommandConstructor();
      if (slashCommandInstance.isAdmin)
        slashCommandInstance.defaultPermission = false;
      this.slashCommands.push(slashCommandInstance);
    });
  }

  private async registerSlashCommands(): Promise<void> {
    if (this.client && this.client.application) {
      const client = this.client;
      const guildIds = this.envService.testServerId
        ? [this.envService.testServerId]
        : this.client.guilds.cache.map((guild) => guild.id);

      try {
        await Promise.all(
          guildIds.map((guildId) => {
            const guild = client.guilds.cache.find((g) => g.id === guildId);
            if (guild) {
              return guild.commands.set(this.slashCommands);
            }
          })
        );
      } catch (err) {
        this.logger.error(`Error while registering slash commands`, err);
      }
    }
  }

  private async setSlashCommandPermissions(): Promise<void> {
    if (!this.client) {
      return;
    }
    const client = this.client;

    const botAdminRoleName = this.envService.botAdminRoleName;
    if (botAdminRoleName) {
      const adminCommandNames = this.slashCommands
        .filter((c) => c.isAdmin)
        .map((c) => c.name);

      const guildIds = this.envService.testServerId
        ? [this.envService.testServerId]
        : this.client.guilds.cache.map((guild) => guild.id);

      await Promise.all(
        guildIds.map((guildId) => {
          const guild = client.guilds.cache.find((g) => g.id === guildId);
          if (guild) {
            return allowCommandsForRoleName(
              guild,
              adminCommandNames,
              botAdminRoleName
            );
          }
        })
      );
    }
  }

  private async unregisterSlashCommands(): Promise<void> {
    if (!this.client) return;

    const unregisters = this.client.guilds.cache.map((guild) =>
      guild.commands.set([])
    );

    await Promise.all(unregisters);
  }
}

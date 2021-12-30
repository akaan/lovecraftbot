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

function filterGuilds(
  maybeGuildId: string | undefined
): (guild: Guild) => boolean {
  if (maybeGuildId) {
    return (guild: Guild) => guild.id === maybeGuildId;
  }
  return (_guild: Guild) => true;
}

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

  private getAdminCommands(): ISlashCommand[] {
    return this.slashCommands.filter((sc) => sc.isAdmin);
  }

  private getNonAdminCommands(): ISlashCommand[] {
    return this.slashCommands.filter((sc) => !sc.isAdmin);
  }

  public async registerSlashCommands(): Promise<void> {
    await this.registerNonAdminCommands();
    await this.registerAdminCommands();
  }

  private async registerNonAdminCommands(): Promise<void> {
    if (this.client && this.client.application) {
      try {
        this.logger.log(
          `[SlashCommandManager] Registering application-level commands...`
        );
        await this.client.application.commands.set(this.getNonAdminCommands());
        this.logger.log(
          `[SlashCommandManager] Registered application-level commands`
        );
      } catch (err) {
        this.logger.error(
          `Error while registering non admin slash commands`,
          err
        );
      }
    }
  }

  private async registerAdminCommands(): Promise<void> {
    if (this.client) {
      const guilds = this.client.guilds.cache.filter(
        filterGuilds(this.envService.testServerId)
      );
      const registers = guilds.map(async (guild) => {
        this.logger.log(
          `[SlashCommandManager] Registering guild-level commands for guild ${guild.name}...`
        );
        await guild.commands.set(this.getAdminCommands());
        this.logger.log(
          `[SlashCommandManager] Registered guild-level commands for guild ${guild.name}`
        );
      });
      await Promise.all(registers);
    }
  }

  public async setSlashCommandPermissions(): Promise<void> {
    if (!this.client) {
      return;
    }

    const botAdminRoleName = this.envService.botAdminRoleName;
    if (botAdminRoleName) {
      const adminCommandNames = this.getAdminCommands().map((c) => c.name);

      try {
        await Promise.all(
          this.client.guilds.cache
            .filter(filterGuilds(this.envService.testServerId))
            .map((guild) => {
              this.logger.log(
                `[SlashCommandManager] Setting permissions for commands in guild ${guild.name}`
              );
              return allowCommandsForRoleName(
                guild,
                adminCommandNames,
                botAdminRoleName
              ).then(() =>
                this.logger.log(
                  `[SlashCommandManager] Permissions set for commands in guild ${guild.name}`
                )
              );
            })
        );
      } catch (err) {
        this.logger.error(
          "Error while setting permissions on admin commands",
          err
        );
      }
    }
  }

  private async unregisterSlashCommands(): Promise<void> {
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
        "Error while cleaning up before registering slash commands",
        err
      );
    }
  }
}

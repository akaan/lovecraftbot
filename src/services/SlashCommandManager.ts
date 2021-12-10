import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import { Client, CommandInteraction } from "discord.js";
import { Routes } from "discord-api-types/v9";
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
      .catch((err) =>
        this.logger.error("Error while registering commands", err)
      );
  }

  public handleCommandInteraction(
    commandInteraction: CommandInteraction
  ): Promise<ISlashCommandResult> {
    const slashCommand = this.slashCommands.find(
      (sc) => sc.data.name === commandInteraction.commandName
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
      this.slashCommands.push(slashCommandInstance);
    });
  }

  // FIXME: The type should be RESTPostAPIApplicationCommandsJSONBody
  // but there are bugs.
  private getSlashCommandsData(): ReturnType<SlashCommandBuilder["toJSON"]>[] {
    return this.slashCommands.map((slashCommand) => slashCommand.data.toJSON());
  }

  private async registerSlashCommands(): Promise<void> {
    const DISCORD_TOKEN = this.envService.discordToken;
    if (!DISCORD_TOKEN) {
      throw new Error("No Discord token specified!");
    }

    if (this.client && this.client.application) {
      const applicationId = this.client.application.id;
      const guildIds = this.envService.testServerId
        ? [this.envService.testServerId]
        : this.client.guilds.cache.map((guild) => guild.id);

      const commands = this.getSlashCommandsData();
      const rest = new REST({ version: "9" }).setToken(DISCORD_TOKEN);
      try {
        await Promise.all(
          guildIds.map((guildId) =>
            rest.put(Routes.applicationGuildCommands(applicationId, guildId), {
              body: commands,
            })
          )
        );
      } catch (err) {
        this.logger.error(`Error while registering slash commands`, err);
      }
    }
  }
}

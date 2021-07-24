import * as Discord from "discord.js";
import { Inject } from "typescript-ioc";

import { nameOfConstructor } from "./ClassUtils";

import { LoggerService } from "./services/logger";
import { CommandParser } from "./services/command-parser";
import { PresenceService } from "./services/presence";
import { EnvService } from "./services/env";
import { HelpService } from "./services/help";
import { EmojiService } from "./services/emoji";
import { CardService } from "./services/card";
import { CardOfTheDayService } from "./services/cardOfTheDay";
import { RulesService } from "./services/rules";

export class Bot {
  private client?: Discord.Client;
  @Inject private logger?: LoggerService;

  @Inject private helpService?: HelpService;
  @Inject private envService?: EnvService;
  @Inject private presenceService?: PresenceService;
  @Inject private emojiService?: EmojiService;
  @Inject private cardService?: CardService;
  @Inject private cardOfTheDayService?: CardOfTheDayService;
  @Inject private rulesService?: RulesService;

  @Inject private commandParser?: CommandParser;

  public async init(): Promise<void> {
    if (!this.envService) {
      throw new Error("No EnvService");
    }

    const DISCORD_TOKEN = this.envService.discordToken;
    const COMMAND_PREFIX = this.envService.commandPrefix;
    if (!DISCORD_TOKEN) {
      throw new Error("No Discord token specified!");
    }

    this.client = new Discord.Client();
    const client = this.client;
    if (this.logger) this.logger.log("Connecting to Discord ...");

    this.client.on("ready", () => {
      if (this.logger) this.logger.log("Connected.");

      [
        this.helpService,
        this.envService,
        this.presenceService,
        this.emojiService,
        this.commandParser,
        this.cardService,
        this.cardOfTheDayService,
        this.rulesService,
      ].map((service) => {
        if (service)
          service
            .init(client)
            .then(() => {
              if (this.logger)
                this.logger.log(
                  "Initialized service",
                  nameOfConstructor(service)
                );
            })
            .catch(() => {
              if (this.logger)
                this.logger.log(
                  "Problem initializing service",
                  nameOfConstructor(service)
                );
            });
      });
    });

    this.client.on("message", (msg) => {
      if (!this.commandParser) {
        return;
      }

      if (
        msg.author.bot ||
        (this.client &&
          this.client.user &&
          msg.author.id === this.client.user.id)
      ) {
        return;
      }

      if (
        this.envService &&
        this.envService.testServerId &&
        msg.guild &&
        this.envService.testServerId !== msg.guild.id
      ) {
        return;
      }

      const content = msg.content;

      if (content.startsWith(COMMAND_PREFIX)) {
        this.commandParser
          .handleCommand(msg)
          .then((result) => this.logger && this.logger.logCommandResult(result))
          .catch(
            (err) =>
              this.logger && this.logger.log("Error handling command", err)
          );
      } else {
        this.commandParser.handleMessage(msg);
      }
    });

    this.client.on("messageReactionAdd", (reaction, user) => {
      if (!this.commandParser || user.bot) {
        return;
      }

      this.commandParser.handleEmojiAdd(reaction, user);
    });

    this.client.on("messageReactionRemove", (reaction, user) => {
      if (!this.commandParser || user.bot) {
        return;
      }

      this.commandParser.handleEmojiRemove(reaction, user);
    });

    await this.client.login(DISCORD_TOKEN);
    return;
  }

  public shutdown(): void {
    if (!this.client) {
      return;
    }
    this.logger && this.logger.log("Disconnecting...");
    this.client.destroy();
    this.logger && this.logger.log("Disconnected.");
  }
}

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

export class Bot {
  @Inject private logger?: LoggerService;

  @Inject private helpService?: HelpService;
  @Inject private envService?: EnvService;
  @Inject private presenceService?: PresenceService;
  @Inject private emojiService?: EmojiService;
  @Inject private cardService?: CardService;
  @Inject private cardOfTheDayService?: CardOfTheDayService;

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

    const client = new Discord.Client();
    if (this.logger) this.logger.log("Connecting to Discord ...");

    client.on("ready", () => {
      if (this.logger) this.logger.log("Connected.");

      [
        this.helpService,
        this.envService,
        this.presenceService,
        this.emojiService,
        this.commandParser,
        this.cardService,
        this.cardOfTheDayService,
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

    client.on("message", (msg) => {
      if (!this.commandParser) {
        return;
      }

      if (msg.author.bot || (client.user && msg.author.id === client.user.id)) {
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

    client.on("messageReactionAdd", (reaction, user) => {
      if (!this.commandParser || user.bot) {
        return;
      }

      this.commandParser.handleEmojiAdd(reaction, user);
    });

    client.on("messageReactionRemove", (reaction, user) => {
      if (!this.commandParser || user.bot) {
        return;
      }

      this.commandParser.handleEmojiRemove(reaction, user);
    });

    await client.login(DISCORD_TOKEN);
    return;
  }
}

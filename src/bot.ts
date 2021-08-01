import * as Discord from "discord.js";
import { Inject } from "typescript-ioc";

import { nameOfConstructor } from "./ClassUtils";

import { LoggerService } from "./services/LoggerService";
import { CommandParser } from "./services/CommandParser";
import { PresenceService } from "./services/PresenceService";
import { EnvService } from "./services/EnvService";
import { EmojiService } from "./services/EmojiService";
import { CardService } from "./services/CardService";
import { CardOfTheDayService } from "./services/CardOfTheDayService";
import { RulesService } from "./services/RulesService";

export class Bot {
  private client?: Discord.Client;

  @Inject private cardOfTheDayService!: CardOfTheDayService;
  @Inject private cardService!: CardService;
  @Inject private envService!: EnvService;
  @Inject private emojiService!: EmojiService;
  @Inject private logger!: LoggerService;
  @Inject private presenceService!: PresenceService;
  @Inject private rulesService!: RulesService;

  // Celui-là doit arriver en dernier
  @Inject private commandParser!: CommandParser;

  public async init(): Promise<void> {
    const DISCORD_TOKEN = this.envService.discordToken;
    if (!DISCORD_TOKEN) {
      throw new Error("No Discord token specified!");
    }

    const COMMAND_PREFIX = this.envService.commandPrefix;

    this.client = new Discord.Client();
    const client = this.client;
    this.logger.log("Connecting to Discord ...");

    this.client.on("ready", () => {
      this.logger.log("Connected.");

      [
        this.presenceService,
        this.emojiService,
        this.cardService,
        this.cardOfTheDayService,
        this.rulesService,
        this.commandParser,
      ].map((service) => {
        service
          .init(client)
          .then(() => {
            this.logger.log("Initialized service", nameOfConstructor(service));
          })
          .catch(() => {
            this.logger.log(
              "Problem initializing service",
              nameOfConstructor(service)
            );
          });
      });
    });

    this.client.on("message", (msg) => {
      if (
        msg.author.bot ||
        (this.client &&
          this.client.user &&
          msg.author.id === this.client.user.id)
      ) {
        return;
      }

      if (
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
          .then((result) => this.logger.logCommandResult(result))
          .catch((err) => this.logger.log("Error handling command", err));
      } else {
        this.commandParser.handleMessage(msg);
      }
    });

    this.client.on("messageReactionAdd", (reaction, user) => {
      if (user.bot) {
        return;
      }

      this.commandParser.handleEmojiAdd(reaction, user);
    });

    this.client.on("messageReactionRemove", (reaction, user) => {
      if (user.bot) {
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
    this.logger.log("Disconnecting...");
    this.client.destroy();
    this.logger.log("Disconnected.");
  }
}

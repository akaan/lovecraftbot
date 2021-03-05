import * as Discord from "discord.js";
import { Inject } from "typescript-ioc";

import { LoggerService } from "./services/logger";
import { CommandParser } from "./services/command-parser";
import { PresenceService } from "./services/presence";
import { EnvService } from "./services/env";
import { HelpService } from "./services/help";
import { EmojiService } from "./services/emoji";
import { CardService } from "./services/card";

export class Bot {
  @Inject private logger: LoggerService;

  @Inject private helpService: HelpService;
  @Inject private envService: EnvService;
  @Inject private presenceService: PresenceService;
  @Inject private emojiService: EmojiService;
  @Inject private cardService: CardService;

  @Inject private commandParser: CommandParser;

  public async init(): Promise<void> {
    const DISCORD_TOKEN = this.envService.discordToken;
    const COMMAND_PREFIX = this.envService.commandPrefix;
    if (!DISCORD_TOKEN) {
      throw new Error("No Discord token specified!");
    }

    const client = new Discord.Client();
    this.logger.log("Connecting to Discord ...");
    await client.login(DISCORD_TOKEN);
    this.logger.log("Connected.");

    client.on("ready", () => {
      this.logger.log("Initialized bot!");

      [
        this.helpService,
        this.envService,
        this.presenceService,
        this.emojiService,
        this.commandParser,
        this.cardService,
      ].map((service) => {
        service.init(client).catch(() => {
          this.logger.log(
            "Problem initializing service",
            service.constructor.name
          );
        });
      });
    });

    client.on("message", (msg) => {
      if (msg.author.bot || msg.author.id === client.user.id) {
        return;
      }

      if (
        this.envService.testServerId &&
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

    client.on("messageReactionAdd", (reaction, user) => {
      if (user.bot) {
        return;
      }

      this.commandParser.handleEmojiAdd(reaction, user);
    });

    client.on("messageReactionRemove", (reaction, user) => {
      if (user.bot) {
        return;
      }

      this.commandParser.handleEmojiRemove(reaction, user);
    });

    return;
  }
}

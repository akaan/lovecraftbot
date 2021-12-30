import * as Discord from "discord.js";
import { Inject } from "typescript-ioc";

import { nameOfConstructor } from "./ClassUtils";
import { BlobGameService } from "./services/BlobGameService";
import { CardOfTheDayService } from "./services/CardOfTheDayService";
import { CardService } from "./services/CardService";
import { CommandParser } from "./services/CommandParser";
import { EmojiService } from "./services/EmojiService";
import { EnvService } from "./services/EnvService";
import { LoggerService } from "./services/LoggerService";
import { MassMultiplayerEventService } from "./services/MassMultiplayerEventService";
import { PresenceService } from "./services/PresenceService";
import { RulesService } from "./services/RulesService";
import { SlashCommandManager } from "./services/SlashCommandManager";

export class Bot {
  private client?: Discord.Client;

  @Inject private blobGameService!: BlobGameService;
  @Inject private cardOfTheDayService!: CardOfTheDayService;
  @Inject private cardService!: CardService;
  @Inject private envService!: EnvService;
  @Inject private emojiService!: EmojiService;
  @Inject private logger!: LoggerService;
  @Inject private presenceService!: PresenceService;
  @Inject private rulesService!: RulesService;
  @Inject private massMultiplayerEventService!: MassMultiplayerEventService;

  // Ces deux là doivent arriver en dernier
  @Inject private commandParser!: CommandParser;
  @Inject private slashCommandManager!: SlashCommandManager;

  public async init(): Promise<void> {
    const DISCORD_TOKEN = this.envService.discordToken;
    if (!DISCORD_TOKEN) {
      throw new Error("No Discord token specified!");
    }

    const COMMAND_PREFIX = this.envService.commandPrefix;

    this.client = new Discord.Client({
      intents: [
        Discord.Intents.FLAGS.GUILDS,
        Discord.Intents.FLAGS.GUILD_MESSAGES,
        Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
      ],
    });
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
        this.blobGameService,
        this.massMultiplayerEventService,
        this.commandParser,
        this.slashCommandManager,
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

    this.client.on("interactionCreate", (interaction) => {
      if (interaction.isCommand()) {
        this.slashCommandManager
          .handleCommandInteraction(interaction)
          .then((slashCommandResult) => {
            this.logger.log(`Slash command handled:`, slashCommandResult);
          })
          .catch((err) =>
            this.logger.error(`Error while handling slash command`, err)
          );
      }
    });

    this.client.on("messageCreate", (msg) => {
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

      this.commandParser.handleEmojiAdd(
        reaction as Discord.MessageReaction,
        user
      );
    });

    this.client.on("messageReactionRemove", (reaction, user) => {
      if (user.bot) {
        return;
      }

      this.commandParser.handleEmojiRemove(
        reaction as Discord.MessageReaction,
        user
      );
    });

    await this.client.login(DISCORD_TOKEN);
    return;
  }

  public shutdown(): Promise<void> {
    if (!this.client) {
      return Promise.resolve();
    }
    this.logger.log("Disconnecting...");
    this.client.destroy();
    this.logger.log("Disconnected.");
    return Promise.resolve();
  }
}

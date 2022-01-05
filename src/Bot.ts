import * as Discord from "discord.js";
import { Inject } from "typescript-ioc";

import { nameOfConstructor } from "./ClassUtils";
import { ApplicationCommandManager } from "./services/ApplicationCommandManager";
import { BlobGameService } from "./services/BlobGameService";
import { CardOfTheDayService } from "./services/CardOfTheDayService";
import { CardService } from "./services/CardService";
import { CommandParser } from "./services/CommandParser";
import { EmojiService } from "./services/EmojiService";
import { EnvService } from "./services/EnvService";
import { LoggerService } from "./services/LoggerService";
import { MassMultiplayerEventService } from "./services/MassMultiplayerEventService";
import { NewsService } from "./services/NewsService";
import { PresenceService } from "./services/PresenceService";
import { RulesService } from "./services/RulesService";

export class Bot {
  private static LOG_LABEL = "Bot";

  private client!: Discord.Client;
  private commandPrefix!: string;

  @Inject private blobGameService!: BlobGameService;
  @Inject private cardOfTheDayService!: CardOfTheDayService;
  @Inject private cardService!: CardService;
  @Inject private envService!: EnvService;
  @Inject private emojiService!: EmojiService;
  @Inject private logger!: LoggerService;
  @Inject private newsService!: NewsService;
  @Inject private presenceService!: PresenceService;
  @Inject private rulesService!: RulesService;
  @Inject private massMultiplayerEventService!: MassMultiplayerEventService;

  // Ces deux là doivent arriver en dernier
  @Inject private commandParser!: CommandParser;
  @Inject private applicationCommandManager!: ApplicationCommandManager;

  public async init(): Promise<void> {
    const DISCORD_TOKEN = this.envService.discordToken;
    if (!DISCORD_TOKEN) {
      throw new Error("No Discord token specified!");
    }

    this.commandPrefix = this.envService.commandPrefix;

    this.client = new Discord.Client({
      intents: [
        Discord.Intents.FLAGS.GUILDS,
        Discord.Intents.FLAGS.GUILD_MESSAGES,
        Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
      ],
    });
    this.client.on("ready", () => this.handleReady());
    this.client.on("interactionCreate", (interaction) =>
      this.handleInteraction(interaction)
    );
    this.client.on("messageCreate", (msg) => this.handleMessage(msg));
    this.client.on("messageReactionAdd", (reaction, user) =>
      this.handleAddReaction(reaction, user)
    );
    this.client.on("messageReactionRemove", (reaction, user) =>
      this.handleRemoveReaction(reaction, user)
    );

    this.logger.info(Bot.LOG_LABEL, "Connexion à Discord ...");
    await this.client.login(DISCORD_TOKEN);
    return;
  }

  private handleReady(): void {
    this.logger.info(Bot.LOG_LABEL, "Connecté.");

    [
      this.logger,
      this.presenceService,
      this.emojiService,
      this.cardService,
      this.cardOfTheDayService,
      this.newsService,
      this.rulesService,
      this.blobGameService,
      this.massMultiplayerEventService,
      this.commandParser,
      this.applicationCommandManager,
    ].map((service) => {
      service
        .init(this.client)
        .then(() => {
          this.logger.info(
            Bot.LOG_LABEL,
            `Service ${nameOfConstructor(service)} initialisé`
          );
        })
        .catch((err) => {
          this.logger.error(
            Bot.LOG_LABEL,
            `Problème à l'initialisation du service
            ${nameOfConstructor(service)}`,
            { error: err }
          );
        });
    });
  }

  private handleInteraction(interaction: Discord.Interaction): void {
    if (interaction.isCommand()) {
      this.applicationCommandManager
        .handleCommandInteraction(interaction)
        .then((applicationCommandResult) => {
          this.logger.info(
            Bot.LOG_LABEL,
            `Commande d'application traitée`,
            applicationCommandResult
          );
        })
        .catch((err) =>
          this.logger.error(
            Bot.LOG_LABEL,
            `Erreur au traitement d'une commande d'application`,
            { error: err }
          )
        );
    }
  }

  private handleMessage(msg: Discord.Message): void {
    if (
      msg.author.bot ||
      (this.client && this.client.user && msg.author.id === this.client.user.id)
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

    if (content.startsWith(this.commandPrefix)) {
      this.commandParser
        .handleCommand(msg)
        .then((result) =>
          this.logger.info(Bot.LOG_LABEL, "Commande classique traitée", {
            result,
          })
        )
        .catch((err) =>
          this.logger.error(
            Bot.LOG_LABEL,
            "Erreur au traitement d'une commande classique",
            {
              error: err,
            }
          )
        );
    } else {
      this.commandParser.handleMessage(msg);
    }
  }

  private handleAddReaction(
    reaction: Discord.MessageReaction | Discord.PartialMessageReaction,
    user: Discord.User | Discord.PartialUser
  ): void {
    if (user.bot) {
      return;
    }

    this.commandParser.handleEmojiAdd(
      reaction as Discord.MessageReaction,
      user
    );
  }

  private handleRemoveReaction(
    reaction: Discord.MessageReaction | Discord.PartialMessageReaction,
    user: Discord.User | Discord.PartialUser
  ): void {
    if (user.bot) {
      return;
    }

    this.commandParser.handleEmojiRemove(
      reaction as Discord.MessageReaction,
      user
    );
  }

  public shutdown(): Promise<void> {
    if (!this.client) {
      return Promise.resolve();
    }
    this.logger.info(Bot.LOG_LABEL, "Déconnexion...");
    this.client.destroy();
    this.logger.info(Bot.LOG_LABEL, "Déconnecté.");
    return Promise.resolve();
  }
}

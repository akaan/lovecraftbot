import { Client, Guild } from "discord.js";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { CardService, SearchType } from "./CardService";
import { GuildConfigurationService } from "./GuildConfigurationService";
import { LoggerService } from "./LoggerService";
import { RandomService } from "./RandomService";
import { GuildResource } from "./resources/GuildResource";
import { ResourcesService } from "./ResourcesService";

@Singleton
@OnlyInstantiableByContainer
/**
 * Service permettant d'envoyer chaque jour une carte aléatoire dans un canal
 * prévu à cette effet.
 */
export class CardOfTheDayService extends BaseService {
  /** Etiquette utilisée pour les logs de ce service */
  private static LOG_LABEL = "CardOfTheDayService";

  /** Nom du fichier de sauvegarde des codes de cartes envoyés */
  private static CARD_CODES_SENT_FILE_NAME = "cardOfTheDay.json";

  /** Codes des cartes déjà envoyées par serveur */
  private cardCodesSent!: GuildResource<string[]>;

  /** Timer permettant de gérer la routine d'envoi de carte */
  private timer: NodeJS.Timer | undefined = undefined;

  @Inject private cardService!: CardService;
  @Inject private logger!: LoggerService;
  @Inject private randomService!: RandomService;
  @Inject private resourcesService!: ResourcesService;
  @Inject private guildConfigurationService!: GuildConfigurationService;

  public async init(client: Client): Promise<void> {
    await super.init(client);

    this.cardCodesSent = new GuildResource<string[]>({
      client,
      filename: CardOfTheDayService.CARD_CODES_SENT_FILE_NAME,
      logLabel: CardOfTheDayService.LOG_LABEL,
      logger: this.logger,
      resourcesService: this.resourcesService,
    });

    this.start();
  }

  public shutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    return Promise.resolve();
  }

  /**
   * Démarre la routine qui vérifie l'heure courante et envoie la carte à
   * l'heure indiquée.
   */
  public start(): void {
    this.timer = setInterval(() => {
      const now = new Date();
      if (this.client) {
        this.client.guilds.cache.forEach((guild) => {
          const cardOfTheDayHour =
            this.guildConfigurationService.getConfig<number>(
              guild,
              "cardOfTheDayHour"
            );
          if (!cardOfTheDayHour) {
            this.logger.warn(
              CardOfTheDayService.LOG_LABEL,
              `Pas d'heure d'envoi de la carte du jour sur le serveur ${guild.name}`
            );

            return;
          }
          if (now.getHours() === cardOfTheDayHour && now.getMinutes() === 0) {
            void this.sendCardOfTheDay(guild);
          }
        });
      }
    }, 1000 * 60);
  }

  /**
   * Renvoie la liste des codes des cartes déjà tirées pour le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @returns La liste des codes des cartes déjà tirées
   */
  public getCardCodesSent(guild: Guild): string[] {
    return this.cardCodesSent.get(guild) || [];
  }

  /**
   * Ajoute les codes spécifiés à la liste des codes des cartes déjà tirées pour
   * le seveur indiqué.
   *
   * @param guild Le seveur concerné
   * @param codes Des codes de cartes à ajouter à la liste
   */
  public addCardSent(guild: Guild, codes: string[]): Promise<void> {
    return this.cardCodesSent.set(guild, [
      ...(this.cardCodesSent.get(guild) || []),
      ...codes,
    ]);
  }

  /**
   * Envoie une carte aléatoire sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois la carte envoyée
   */
  public async sendCardOfTheDay(guild: Guild): Promise<void> {
    const cardOfTheDayChannelId =
      this.guildConfigurationService.getConfig<string>(
        guild,
        "cardOfTheDayChannelId"
      );
    if (!cardOfTheDayChannelId) {
      this.logger.warn(
        CardOfTheDayService.LOG_LABEL,
        `Impossible d'envoyer la carte du jour en l'absence d'un canal pour l'envoi`
      );
      return;
    }

    const cardOfTheDayChannel = guild.channels.cache.find(
      (c) => c.id === cardOfTheDayChannelId
    );
    if (!cardOfTheDayChannel) {
      this.logger.warn(
        CardOfTheDayService.LOG_LABEL,
        `Impossible de récupérer le canal d'envoi de la carte du jour`,
        { cardOfTheDayChannelId }
      );
      return;
    }
    if (!cardOfTheDayChannel.isTextBased()) {
      this.logger.warn(
        CardOfTheDayService.LOG_LABEL,
        `Impossible d'envoyer la carte du jour sur le canal ${cardOfTheDayChannel.name}`,
        { cardOfTheDayChannelType: cardOfTheDayChannel.type }
      );
      return;
    }

    const allCodes = this.cardService.getAllPlayerCardCodes();
    const remainingCodes = allCodes.filter(
      (code) => !this.getCardCodesSent(guild).includes(code)
    );
    const randomCode =
      remainingCodes[this.randomService.getRandomInt(0, remainingCodes.length)];
    const randomCard = this.cardService.getCards({
      searchString: randomCode,
      searchType: SearchType.BY_CODE,
    });

    if (randomCard.length > 0) {
      const embeds = await this.cardService.createEmbeds(randomCard[0], {
        back: false,
        extended: true,
      });
      const msg = await cardOfTheDayChannel.send({
        embeds: embeds,
      });
      await msg.pin();
      await this.addCardSent(guild, [randomCode]);

      this.logger.info(
        CardOfTheDayService.LOG_LABEL,
        `Carte du jour envoyée.`,
        { cardCode: randomCode }
      );
    } else {
      this.logger.error(
        CardOfTheDayService.LOG_LABEL,
        `Problème lors de la récupération de la carte du jour (code: ${randomCode}).`
      );
    }
  }
}

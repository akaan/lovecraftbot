import axios from "axios";
import { Client, Guild, TextChannel } from "discord.js";
import { JSDOM } from "jsdom";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { GuildConfigurationService } from "./GuildConfigurationService";
import { LoggerService } from "./LoggerService";
import { ResourcesService } from "./ResourcesService";

/** Nom du fichier dans lequel est stocké le dernier lien envoyé */
const LATEST_NEWS_FILE = `latestNews.txt`;

@Singleton
@OnlyInstantiableByContainer
/**
 * Service scrutant la page de news du jeu de cartes Horreur à Arkham et qui
 * envoie le lien vers la dernière news dès qu'elle est publiée.
 */
export class NewsService extends BaseService {
  /** Etiquette utilisée pour les logs de ce service */
  private static LOG_LABEL = "NewsService";

  /** Timer permettant de gérant la routine de vérification des news */
  private timer: NodeJS.Timer | undefined = undefined;

  @Inject private logger!: LoggerService;
  @Inject private resourcesService!: ResourcesService;
  @Inject private guildConfigurationService!: GuildConfigurationService;

  public async init(client: Client) {
    await super.init(client);

    // Toutes les minutes
    this.timer = setInterval(() => {
      this.checkForLatestNews().catch((err) => console.error(err));
    }, 1000 * 60);
  }

  public shutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    return Promise.resolve();
  }

  /**
   * Récupère le lien de la dernière news puis publie ce lien sur chaque serveur
   * si cela est nécessaire.
   *
   * @returns Une promesse résolue une fois le traitement terminé
   */
  public async checkForLatestNews(): Promise<void> {
    this.logger.info(NewsService.LOG_LABEL, `Vérification des dernières news`);
    const latestLink = await this.getLatestNewLink();
    if (latestLink) {
      if (this.client) {
        const sendings = this.client.guilds.cache.map((guild) =>
          this.sendLatestLinkIfNecessary(guild, latestLink)
        );
        await Promise.all(sendings);
      }
    } else {
      this.logger.info(
        NewsService.LOG_LABEL,
        `Impossible de récupérer la dernière news`
      );
    }
  }

  /**
   * Envoie sur le serveur précisé le lien vers la dernière news mais seulement
   * si celui-ci est différent du dernier lien sauvegardé pour ce serveur.
   * S'il y a en effet une différence, le lien sera publié puis sauvegardé.
   *
   * @param guild Le serveur concerné
   * @param latestLink Le lien de la news la plus récente
   * @returns Une promesse résolue une fois le traitement terminé
   */
  private async sendLatestLinkIfNecessary(
    guild: Guild,
    latestLink: string
  ): Promise<void> {
    const lastLinkSent = await this.getLastLinkSent(guild);
    if (lastLinkSent === undefined || latestLink !== lastLinkSent) {
      this.logger.info(
        NewsService.LOG_LABEL,
        `Nouvelle news à envoyer sur le serveur ${guild.name}`
      );

      const newsChannelId = this.guildConfigurationService.getConfig<string>(
        guild,
        "newsChannelId"
      );
      if (!newsChannelId) {
        this.logger.warn(
          NewsService.LOG_LABEL,
          `Impossible d'envoyer la news en l'absence d'un canal pour l'envoi`
        );
        return;
      }

      const newsChannel = guild.channels.cache.find(
        (channel) => channel.isText() && channel.id == newsChannelId
      ) as TextChannel | undefined;
      if (newsChannel) {
        await newsChannel.send({ content: latestLink });
        await this.saveLastLinkSent(guild, latestLink);
      } else {
        this.logger.info(
          NewsService.LOG_LABEL,
          `Le canal d'identifiant "${newsChannelId}" n'a pas été trouvé sur le serveur ${guild.name} pour l'envoi de la news`
        );
      }
    }
  }

  /**
   * Charge la page des news du jeu de cartes Horreur à Arkham et récupère le
   * premier lien de la liste (et donc le lien de la dernière news publiée).
   *
   * @returns Une promesse résolu avec le dernier lien de news
   */
  private async getLatestNewLink(): Promise<string | undefined> {
    try {
      const baseUrl = `https://www.fantasyflightgames.com`;
      const url = `${baseUrl}/en/news/tag/arkham-horror-the-card-game/?`;
      const response = await axios.get<string>(url);
      const { document } = new JSDOM(response.data).window;
      const firstLinkElem = document.querySelector(
        ".blog-list > .blog-item > .blog-text > h1 > a"
      );
      if (firstLinkElem) {
        return `${baseUrl}${firstLinkElem.getAttribute("href") || ""}`;
      }
    } catch (err) {
      return;
    }
  }

  /**
   * Récupérer dans le fichier et pour un serveur donné le dernier lien
   * envoyé.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le dernier lien envoyé s'il existe
   */
  private async getLastLinkSent(guild: Guild): Promise<string | undefined> {
    const dataAvailable = await this.resourcesService.guildResourceExists(
      guild,
      LATEST_NEWS_FILE
    );
    if (dataAvailable) {
      return await this.resourcesService.readGuildResource(
        guild,
        LATEST_NEWS_FILE
      );
    }
  }

  /**
   * Sauvegarde dans le fichier et pour un serveur donné le dernier lien ayant
   * été envoyé.
   *
   * @param guild Le serveur concerné
   * @param lastLinkSent Le lien à sauvegarder
   * @returns Une promesse résolue une fois la sauvegarde effectuée
   */
  private async saveLastLinkSent(
    guild: Guild,
    lastLinkSent: string
  ): Promise<void> {
    return await this.resourcesService.saveGuildResource(
      guild,
      LATEST_NEWS_FILE,
      lastLinkSent
    );
  }
}

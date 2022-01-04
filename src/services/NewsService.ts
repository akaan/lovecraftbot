import axios from "axios";
import { Client, Guild, TextChannel } from "discord.js";
import { JSDOM } from "jsdom";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { LoggerService } from "./LoggerService";
import { ResourcesService } from "./ResourcesService";

const LATEST_NEWS_FILE = `latestNews.txt`;

@Singleton
@OnlyInstantiableByContainer
export class NewsService extends BaseService {
  private static LOG_LABEL = "NewsService";

  @Inject logger!: LoggerService;
  @Inject resourcesService!: ResourcesService;

  public async init(client: Client) {
    await super.init(client);

    setInterval(() => {
      this.checkForLatestNews().catch((err) => console.error(err));
    }, 1000 * 60);
  }

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
      const globalChannel = guild.channels.cache.find(
        (channel) =>
          channel.isText() && channel.name.toLowerCase().includes("général")
      ) as TextChannel | undefined;
      if (globalChannel) {
        await globalChannel.send({ content: latestLink });
        await this.saveLastLinkSent(guild, latestLink);
      } else {
        this.logger.info(
          NewsService.LOG_LABEL,
          `Le serveur ${guild.name} n'a pas de canal "général" pour l'envoi de la news`
        );
      }
    }
  }

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

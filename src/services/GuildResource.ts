import { Client, Guild } from "discord.js";

import { LoggerService } from "./LoggerService";
import { ResourcesService } from "./ResourcesService";

/**
 * Les paramètres nécessaires au fonctionnement d'un ressource de serveur.
 */
interface GuildResourceParams {
  /** Le nom du fichier pour la sauvegarde */
  filename: string;

  /** Le client Discord permettant d'accéder aux serveurs */
  client: Client;

  /** Le logger */
  logger: LoggerService;

  /** L'étiquette pour les logs */
  logLabel: string;

  /** Le service de gestion des ressources */
  resourcesService: ResourcesService;
}

/**
 * Une resource niveau serveur qui gère le chargement et la sauvegarde.
 *
 * @template T Le type de la valeur gérée par cette ressource niveau serveur.
 */
export class GuildResource<T> {
  /** Le nom du fichier pour la sauvegarde */
  private filename: string;

  /** Le logger */
  private logger: LoggerService;

  /** L'étiquette pour les logs */
  private logLabel: string;

  /** Le service de gestion des ressources */
  private resourcesService: ResourcesService;

  /** Les valeurs gérées, par identifiant de serveur */
  private valueByGuidId: { [guildId: string]: T };

  /**
   * @param params Les paramètres pour le fonctionnement de cette ressource
   */
  constructor(params: GuildResourceParams) {
    this.filename = params.filename;
    this.resourcesService = params.resourcesService;
    this.logger = params.logger;
    this.logLabel = params.logLabel;
    this.valueByGuidId = {};

    params.client.guilds.cache.forEach((guild) => void this.load(guild));
    params.client.on("guildCreate", (guild) => void this.load(guild));
  }

  /**
   * Récupère la valeur gérée par cette ressource pour le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @returns La valeur s'il y en a une ou `undefined` sinon
   */
  public get(guild: Guild): T | undefined {
    if (this.valueByGuidId[guild.id]) {
      return this.valueByGuidId[guild.id];
    }
  }

  /**
   * Positionner la valeur gérée par cette ressource pour le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @param value La valeur a positionner
   */
  public set(guild: Guild, value: T): void {
    this.valueByGuidId[guild.id] = value;
    void this.save(guild);
  }

  /**
   * Charge la ressource depuis le fichier pour un serveur donné.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois la ressource chargée
   */
  private async load(guild: Guild): Promise<void> {
    try {
      const resourceExists = await this.resourcesService.guildResourceExists(
        guild,
        this.filename
      );

      if (resourceExists) {
        const raw = await this.resourcesService.readGuildResource(
          guild,
          this.filename
        );
        if (raw) {
          this.valueByGuidId[guild.id] = JSON.parse(raw) as T;
        }
      }
    } catch (error) {
      this.logger.error(
        this.logLabel,
        `Erreur au chargement de la ressource de serveur ${this.filename}`,
        { error }
      );
    }
  }

  /**
   * Sauvegarde la ressource sur le fichier pour un serveur donné.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois la ressource sauvegardée
   */
  private async save(guild: Guild): Promise<void> {
    if (!this.valueByGuidId[guild.id]) return;

    try {
      await this.resourcesService.saveGuildResource(
        guild,
        this.filename,
        JSON.stringify(this.valueByGuidId[guild.id], null, "  ")
      );
    } catch (error) {
      this.logger.error(
        this.logLabel,
        `Erreur à la sauvegarde de la ressource de serveur ${this.filename}`,
        { error }
      );
    }
  }
}

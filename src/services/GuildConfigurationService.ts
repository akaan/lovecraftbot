import { Client, Guild } from "discord.js";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { GuildResource } from "./GuildResource";
import { LoggerService } from "./LoggerService";
import { ResourcesService } from "./ResourcesService";

@Singleton
@OnlyInstantiableByContainer
export class GuildConfigurationService extends BaseService {
  /** Etiquette utilisée pour les logs de ce service */
  private static LOG_LABEL = "GuildConfigurationService";

  /**
   * Le nom de fichier dans lequel est conservé la configuration pour un serveur
   */
  private static CONFIGURATION_FILE_NAME = "guildConfig.json";

  @Inject resources!: ResourcesService;
  @Inject logger!: LoggerService;

  /** Les données de configuration */
  private config!: GuildResource<{ [key: string]: unknown }>;

  public async init(client: Client): Promise<void> {
    await super.init(client);
    this.config = new GuildResource<{ [key: string]: unknown }>({
      client,
      filename: GuildConfigurationService.CONFIGURATION_FILE_NAME,
      logger: this.logger,
      logLabel: GuildConfigurationService.LOG_LABEL,
      resourcesService: this.resources,
    });
  }

  /**
   * Récupère la valeur d'une donnée de configuration sur un serveur donné.
   *
   * @template T Le type de la donnée
   * @param guild Le serveur concerné
   * @param key La clé de la donnée de configuration
   * @returns La valeur de la donnée de configuration
   */
  public getConfig<T>(guild: Guild, key: string): T | undefined {
    const guildConfig = this.config.get(guild);
    if (guildConfig && guildConfig[key]) {
      return guildConfig[key] as T;
    }
    return undefined;
  }

  /**
   * Positionne une donnée de configuration sur un serveur donné.
   *
   * @param guild Le serveur concerné
   * @param key La clé de la donnée de configuration
   * @param value La valeur de la donnée de configuration
   */
  public setConfig(guild: Guild, key: string, value: unknown): void {
    let guildConfig = this.config.get(guild);
    if (!guildConfig) {
      guildConfig = {};
    }
    this.config.set(guild, { ...guildConfig, [key]: value });
  }
}

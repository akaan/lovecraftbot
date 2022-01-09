import { Client, Guild } from "discord.js";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

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

  /** Les données de configuration, par identifiant de serveur */
  private configByGuildId: { [guildId: string]: { [key: string]: unknown } } =
    {};

  public async init(client: Client): Promise<void> {
    await super.init(client);

    client.guilds.cache.forEach((guild) => void this.loadConfig(guild));
    client.on("guildCreate", (guild) => void this.loadConfig(guild));
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
    const guildConfig = this.configByGuildId[guild.id];
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
  public async setConfig(
    guild: Guild,
    key: string,
    value: unknown
  ): Promise<void> {
    const guildConfig = this.configByGuildId[guild.id];
    if (!guildConfig) {
      await this.initConfig(guild);
    }
    guildConfig[key] = value;
    await this.saveConfig(guild);
  }

  /**
   * Charge les données de configuration pour le serveur indiqué.
   *
   * @param guild Le serveur concerné
   */
  private async loadConfig(guild: Guild): Promise<void> {
    try {
      const configFileExists = await this.resources.guildResourceExists(
        guild,
        GuildConfigurationService.CONFIGURATION_FILE_NAME
      );
      if (configFileExists) {
        const raw = await this.resources.readGuildResource(
          guild,
          GuildConfigurationService.CONFIGURATION_FILE_NAME
        );
        if (raw) {
          const parsed = JSON.parse(raw) as { [key: string]: unknown };
          this.configByGuildId[guild.id] = parsed;
        }
      } else {
        void this.initConfig(guild);
      }
    } catch (error) {
      this.logger.error(
        GuildConfigurationService.LOG_LABEL,
        `Erreur au chargement du fichier de configuration pour le serveur ${guild.name}`,
        { error }
      );
      void this.initConfig(guild);
    }
  }

  /**
   * Initie les données de configuration sur le serveur concerné.
   *
   * @param guild Le serveur concerné
   */
  private async initConfig(guild: Guild): Promise<void> {
    this.configByGuildId[guild.id] = {};
    await this.saveConfig(guild);
  }

  /**
   * Sauvegarde les données de configuration pour le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois l'enregistrement terminé
   */
  private async saveConfig(guild: Guild): Promise<void> {
    try {
      await this.resources.saveGuildResource(
        guild,
        GuildConfigurationService.CONFIGURATION_FILE_NAME,
        JSON.stringify(this.configByGuildId[guild.id], null, "  ")
      );
    } catch (error) {
      this.logger.error(
        GuildConfigurationService.LOG_LABEL,
        `Erreur à la sauvegarde du fichier de configuration pour le serveur ${guild.name}`,
        { error }
      );
    }
  }
}

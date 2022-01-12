import { Guild } from "discord.js";

import { ResourceParams } from "./ResourceParams";

/**
 * Une resource niveau serveur qui gère le chargement et la sauvegarde.
 *
 * @template T Le type de la valeur gérée par cette ressource niveau serveur.
 */
export class GuildResource<T> {
  /** Les paramètres de cette ressource */
  private params: ResourceParams<T>;

  /** Les valeurs gérées, par identifiant de serveur */
  private valueByGuidId: { [guildId: string]: T };

  /**
   * @param params Les paramètres pour le fonctionnement de cette ressource
   */
  constructor(params: ResourceParams<T>) {
    this.params = params;
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
   * Positionne la valeur gérée par cette ressource pour le serveur indiqué.
   * La sauvegarde est faite dans la foulée et cette méthode échouera si la
   * sauvegarde a échoué : la valeur gardée en mémoire restera l'ancienne
   * valeur.
   *
   * @param guild Le serveur concerné
   * @param value La valeur a positionner
   * @returns Une promesse résolue une fois la valeur positionnée
   */
  public async set(guild: Guild, value: T): Promise<void> {
    const oldValue = this.valueByGuidId[guild.id];
    try {
      this.valueByGuidId[guild.id] = value;
      await this.save(guild);
    } catch (error) {
      this.valueByGuidId[guild.id] = oldValue;
    }
  }

  /**
   * Charge la ressource depuis le fichier pour un serveur donné.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois la ressource chargée
   */
  private async load(guild: Guild): Promise<void> {
    try {
      const resourceExists =
        await this.params.resourcesService.guildResourceExists(
          guild,
          this.params.filename
        );

      if (resourceExists) {
        const raw = await this.params.resourcesService.readGuildResource(
          guild,
          this.params.filename
        );
        if (raw) {
          this.valueByGuidId[guild.id] = JSON.parse(raw) as T;
          if (this.params.onLoaded)
            this.params.onLoaded(this.valueByGuidId[guild.id]);
        }
      }
    } catch (error) {
      this.params.logger.error(
        this.params.logLabel,
        `Erreur au chargement de la ressource de serveur ${this.params.filename}`,
        { error }
      );
      if (this.params.onLoaded) this.params.onLoaded(undefined);
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
      await this.params.resourcesService.saveGuildResource(
        guild,
        this.params.filename,
        JSON.stringify(this.valueByGuidId[guild.id], null, "  ")
      );
    } catch (error) {
      this.params.logger.error(
        this.params.logLabel,
        `Erreur à la sauvegarde de la ressource de serveur ${this.params.filename}`,
        { error }
      );
    }
  }
}

import {
  Channel,
  Client,
  Guild,
  GuildChannel,
  Message,
  MessageEmbed,
  TextChannel,
} from "discord.js";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { EnvService } from "./EnvService";
import { LoggerService } from "./LoggerService";
import { ResourcesService } from "./ResourcesService";

/**
 * Sous-classe de `Error` pour les erreurs spécifiques au service
 * de gestion des événements multijoueurs.
 */
export class MassMultiplayerEventServiceError extends Error {
  /**
   * Instancie une erreur de type configuration asbente.
   *
   * @returns Erreur de configuration absente
   */
  public static configurationMissing(): MassMultiplayerEventServiceError {
    return new this("MassMultiplayerEventService: configuration absente");
  }

  /**
   * Instancie une erreur de type catégorie de canaux non trouvée.
   *
   * @param categoryName Le nom de la catégorie de canaux attendue
   * @returns Une erreur de catégorie de canaux non trouvée
   */
  public static eventCategoryNotFound(
    categoryName: string
  ): MassMultiplayerEventServiceError {
    return new this(
      `MassMultiplayerEventService: impossible de trouver la catégorie ${categoryName}`
    );
  }
}

@Singleton
@OnlyInstantiableByContainer
/**
 * Service pour lees gestions de événements multijoueurs. Ce service automatise
 * la création de canaux texte & voix pour les sous-groupes et permet de
 * `broadcaster` des messages à l'ensemble des groupes.
 */
export class MassMultiplayerEventService extends BaseService {
  /** Etiquette utilisée pour les logs de ce service */
  private static LOG_LABEL = "MassMultiplayerEventService";

  /** Nom du fichier de sauvegarde de l'état d'un événement multijoueurs */
  private static STATE_FILE_NAME = "massMultiplayerEventsGroups.json";

  @Inject envService!: EnvService;
  @Inject logger!: LoggerService;
  @Inject resourcesService!: ResourcesService;

  /**
   * Pour chaque serveur, les canaux créés par ce service
   */
  private groupChannelsIdByGuildId: { [guildId: string]: string[] } = {};

  public async init(client: Client): Promise<void> {
    await super.init(client);

    await Promise.all(
      client.guilds.cache.map((guild) => {
        return this.loadState(guild);
      })
    );
  }

  /**
   * Permet de savoir si un événement est en cours sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @returns Vrai si un événement est en cours
   */
  public runningEvent(guild: Guild): boolean {
    return (
      this.groupChannelsIdByGuildId[guild.id] &&
      this.groupChannelsIdByGuildId[guild.id].length !== 0
    );
  }

  /**
   * Permet de savoir si le canal fourni est un canal texte créé pour les
   * besoins d'un événement multijoueurs.
   *
   * @param channel Le canal concerné
   * @returns Vrai si le canal est un canal texte créé pour un événement
   */
  public isEventChannel(channel: Channel): boolean {
    if (!channel.isText()) return false;
    if (!this.envService.massMultiplayerEventCategoryName) return false;

    const channelParent = (channel as GuildChannel).parent;
    if (channelParent === null) return false;

    return (
      channelParent.name === this.envService.massMultiplayerEventCategoryName
    );
  }

  /**
   * Permet de savoir si le canal fourni est le canal d'administration des
   * événements multijoueurs.
   *
   * @param channel Le canal concerné
   * @returns Vrai si le canal est le canal d'aministration des événements
   */
  public isAdminChannel(channel: Channel): boolean {
    if (!channel.isText()) return false;
    if (!this.envService.massMultiplayerEventCategoryName) return false;
    if (!this.envService.massMultiplayerEventAdminChannelName) return false;

    const channelParent = (channel as GuildChannel).parent;
    if (channelParent === null) return false;

    return (
      channelParent.name === this.envService.massMultiplayerEventCategoryName &&
      (channel as TextChannel).name ===
        this.envService.massMultiplayerEventAdminChannelName
    );
  }

  /**
   * Permet de récupérer pour un serveur donné le canal d'administration des
   * événements multijoueurs.
   *
   * @param guild Le serveur concerné
   * @returns Le canal d'administration des événements s'il a été trouvé
   */
  public getAdminChannel(guild: Guild): TextChannel | undefined {
    if (
      !this.envService.massMultiplayerEventCategoryName &&
      !this.envService.massMultiplayerEventAdminChannelName
    )
      throw MassMultiplayerEventServiceError.configurationMissing();

    return guild.channels.cache.find(
      (channel) =>
        channel.parent !== null &&
        channel.parent.name ===
          this.envService.massMultiplayerEventCategoryName &&
        channel.type === "GUILD_TEXT" &&
        channel.name === this.envService.massMultiplayerEventAdminChannelName
    ) as TextChannel | undefined;
  }

  /**
   * Créer les canaux texte et voix sur un serveur donné et pour un nombre de
   * groupes de joueurs donné.
   *
   * @param guild Le serveur concerné
   * @param numberOfGroups Le nombrre de groupes de joueurs
   * @returns Une promesse résolue quand tous les canaux sont créés.
   */
  public async createGroupChannels(
    guild: Guild,
    numberOfGroups: number
  ): Promise<void> {
    if (!this.envService.massMultiplayerEventCategoryName)
      throw MassMultiplayerEventServiceError.configurationMissing();

    const categoryId = this.getCategoryIdByName(
      guild,
      this.envService.massMultiplayerEventCategoryName
    );
    if (!categoryId)
      throw MassMultiplayerEventServiceError.eventCategoryNotFound(
        this.envService.massMultiplayerEventCategoryName
      );

    for (let groupNumber = 1; groupNumber <= numberOfGroups; groupNumber++) {
      const groupChannel = await guild.channels.create(
        `groupe-${groupNumber}`,
        {
          type: "GUILD_TEXT",
        }
      );
      await groupChannel.setParent(categoryId);

      const groupVoiceChannel = await guild.channels.create(
        `voice-groupe-${groupNumber}`,
        {
          type: "GUILD_VOICE",
        }
      );
      await groupVoiceChannel.setParent(categoryId);

      if (this.groupChannelsIdByGuildId[guild.id]) {
        this.groupChannelsIdByGuildId[guild.id].push(groupChannel.id);
        this.groupChannelsIdByGuildId[guild.id].push(groupVoiceChannel.id);
      } else {
        this.groupChannelsIdByGuildId[guild.id] = [
          groupChannel.id,
          groupVoiceChannel.id,
        ];
      }
    }
    await this.saveState(guild);
  }

  /**
   * Supprimer pour un serveur donné tous les canaux ayant été créés pour les
   * besoins d'un événements multijoueurs.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois les canaux supprimés
   */
  public async cleanGroupChannels(guild: Guild): Promise<void> {
    const groupsId = this.groupChannelsIdByGuildId[guild.id];
    await Promise.all(
      groupsId.map((groupId) => {
        const channel = guild.channels.cache.find(
          (channel) => channel.id === groupId
        );
        return channel
          ? channel.delete().then(() => null)
          : Promise.resolve(null);
      })
    );
    this.groupChannelsIdByGuildId[guild.id] = [];
    await this.saveState(guild);
  }

  /**
   * Permet de diffuser un message à l'ensemble des groupes d'un événement
   * multijoueurs.
   *
   * @param guild Le serveur concerné
   * @param content Le contenu du message
   * @param excludeGroupIds La liste des identifiants de canaux à exclure de
   *                        la diffusion
   * @returns Une promesse résolue avec les messages envoyés
   */
  public async broadcastMessage(
    guild: Guild,
    content: string | MessageEmbed,
    excludeGroupIds?: string[]
  ): Promise<Message[]> {
    let groupsId = this.groupChannelsIdByGuildId[guild.id];
    if (excludeGroupIds) {
      groupsId = groupsId.filter((id) => !excludeGroupIds.includes(id));
    }

    const channels = groupsId.reduce((memo, groupId) => {
      const maybeChannel = guild.channels.cache.find(
        (channel) => channel.id === groupId
      );
      if (maybeChannel && maybeChannel.type === "GUILD_TEXT") {
        memo.push(maybeChannel as TextChannel);
      }
      return memo;
    }, [] as TextChannel[]);

    const adminChannel = this.getAdminChannel(guild);
    if (adminChannel) {
      channels.push(adminChannel);
    }

    return await Promise.all(
      channels.map((channel) => {
        if (typeof content === "string") {
          return channel.send(content);
        } else {
          return channel.send({ embeds: [content] });
        }
      })
    );
  }

  /**
   * Récupère sur un serveur donné une catégorie de canaux à partir de son nom.
   *
   * @param guild Le serveur concerné
   * @param categoryName Le nom de la catégorie
   * @returns La catégorie de canaux si elle a été trouvée
   */
  private getCategoryIdByName(
    guild: Guild,
    categoryName: string
  ): string | undefined {
    return guild.channels.cache.find(
      (guildChannel) =>
        guildChannel.type === "GUILD_CATEGORY" &&
        guildChannel.name === categoryName
    )?.id;
  }

  /**
   * Sauvegarder l'état du service concernant un serveur donné.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois la sauvegarde terminée
   */
  private async saveState(guild: Guild): Promise<void> {
    try {
      await this.resourcesService.saveGuildResource(
        guild,
        MassMultiplayerEventService.STATE_FILE_NAME,
        JSON.stringify(this.groupChannelsIdByGuildId[guild.id])
      );
    } catch (error) {
      this.logger.error(
        MassMultiplayerEventService.LOG_LABEL,
        "Erreur à la sauvegare de l'état",
        { error }
      );
    }
  }

  /**
   * Charge l'état du service pour un serveur donnée.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois le chargement terminé.
   */
  private async loadState(guild: Guild): Promise<void> {
    try {
      if (
        await this.resourcesService.guildResourceExists(
          guild,
          MassMultiplayerEventService.STATE_FILE_NAME
        )
      ) {
        const raw = await this.resourcesService.readGuildResource(
          guild,
          `massMultiplayerEventsGroups.json`
        );
        if (raw) {
          const groupsId = JSON.parse(raw) as string[];
          this.groupChannelsIdByGuildId[guild.id] = groupsId;
        }
      }
    } catch (error) {
      this.logger.error(
        MassMultiplayerEventService.LOG_LABEL,
        "Erreur au chargement de l'état",
        { error }
      );
    }
  }
}

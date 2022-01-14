import {
  Channel,
  Client,
  Guild,
  Message,
  MessageOptions,
  TextChannel,
} from "discord.js";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { EnvService } from "./EnvService";
import { LoggerService } from "./LoggerService";
import { GuildResource } from "./resources/GuildResource";
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

/**
 * Les données sauvegardées, pour un seerveur donné.
 */
interface MassMultiplayerEventServiceState {
  /** Vrai si un événement est cours */
  running: boolean;

  /** Les identifiants des canaux texte créés */
  textChannelIds: string[];

  /** Les identifiants des canaux voix créés */
  voiceChannelIds: string[];
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
  private static STATE_FILE_NAME = "event.json";

  private eventState!: GuildResource<MassMultiplayerEventServiceState>;

  @Inject envService!: EnvService;
  @Inject logger!: LoggerService;
  @Inject resourcesService!: ResourcesService;

  public async init(client: Client): Promise<void> {
    await super.init(client);

    this.eventState = new GuildResource({
      client,
      filename: MassMultiplayerEventService.STATE_FILE_NAME,
      logLabel: MassMultiplayerEventService.LOG_LABEL,
      logger: this.logger,
      resourcesService: this.resourcesService,
    });
  }

  /**
   * Récupère ou initialise l'état du service de gestion des événements pour le
   * serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @returns L'état pour le serveur
   */
  private getEventState(guild: Guild): MassMultiplayerEventServiceState {
    const maybeState = this.eventState.get(guild);
    if (!maybeState) {
      const initial = {
        running: false,
        textChannelIds: [],
        voiceChannelIds: [],
      };
      void this.eventState.set(guild, initial);
      return initial;
    }
    return maybeState;
  }

  /**
   * Permet de savoir si un événement est en cours sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @returns Vrai si un événement est en cours
   */
  public runningEvent(guild: Guild): boolean {
    return this.getEventState(guild).running;
  }

  // TODO Supprimer la fonction à la fin du refactoring
  public isAdminChannel(_channel: Channel): boolean {
    return false;
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

    const textChannelIds: string[] = [];
    const voiceChannelIds: string[] = [];
    for (let groupNumber = 1; groupNumber <= numberOfGroups; groupNumber++) {
      const groupChannel = await guild.channels.create(
        `groupe-${groupNumber}`,
        {
          type: "GUILD_TEXT",
        }
      );
      await groupChannel.setParent(categoryId);
      textChannelIds.push(groupChannel.id);

      const groupVoiceChannel = await guild.channels.create(
        `voice-groupe-${groupNumber}`,
        {
          type: "GUILD_VOICE",
        }
      );
      await groupVoiceChannel.setParent(categoryId);
      voiceChannelIds.push(groupVoiceChannel.id);
    }
    await this.eventState.set(guild, {
      running: true,
      textChannelIds,
      voiceChannelIds,
    });
  }

  /**
   * Supprimer pour un serveur donné tous les canaux ayant été créés pour les
   * besoins d'un événements multijoueurs.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois les canaux supprimés
   */
  public async cleanGroupChannels(guild: Guild): Promise<void> {
    const channelsId = [
      ...this.getEventState(guild).textChannelIds,
      ...this.getEventState(guild).voiceChannelIds,
    ];
    await Promise.all(
      channelsId.map((groupId) => {
        const channel = guild.channels.cache.find(
          (channel) => channel.id === groupId
        );
        return channel
          ? channel.delete().then(() => null)
          : Promise.resolve(null);
      })
    );
    await this.eventState.set(guild, {
      running: false,
      textChannelIds: [],
      voiceChannelIds: [],
    });
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
    messageOptions: MessageOptions,
    excludeGroupIds?: string[]
  ): Promise<Message[]> {
    let textChannelIds = this.getEventState(guild).textChannelIds;
    if (excludeGroupIds) {
      textChannelIds = textChannelIds.filter(
        (id) => !excludeGroupIds.includes(id)
      );
    }

    const channels = textChannelIds.reduce((memo, groupId) => {
      const maybeChannel = guild.channels.cache.find(
        (channel) => channel.id === groupId
      );
      if (maybeChannel && maybeChannel.type === "GUILD_TEXT") {
        memo.push(maybeChannel as TextChannel);
      }
      return memo;
    }, [] as TextChannel[]);

    return await Promise.all(
      channels.map((channel) => {
        return channel.send(messageOptions);
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
}

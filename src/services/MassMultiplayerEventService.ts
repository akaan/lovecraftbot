import {
  CategoryChannel,
  Channel,
  ChannelType,
  Client,
  Guild,
  Message,
  MessageCreateOptions,
  TextChannel,
} from "discord.js";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { LoggerService } from "./LoggerService";
import { GuildResource } from "./resources/GuildResource";
import { ResourcesService } from "./ResourcesService";

@Singleton
@OnlyInstantiableByContainer
/**
 * Service pour la gestion des événements multijoueurs. Ce service automatise
 * la création de canaux texte & voix pour les sous-groupes et permet de
 * `broadcaster` des messages à l'ensemble des groupes.
 */
export class MassMultiplayerEventService extends BaseService {
  /** Etiquette utilisée pour les logs de ce service */
  private static LOG_LABEL = "MassMultiplayerEventService";

  /** Nom du fichier de sauvegarde de l'état d'un événement multijoueurs */
  private static STATE_FILE_NAME = "event.json";

  /** Etat du service */
  private serviceState!: GuildResource<MassMultiplayerEventServiceState>;

  /** Les timers (par serveur) permettant de gérer la minuterie */
  private timerByGuildId: { [guildId: string]: NodeJS.Timer } = {};

  /** Les écouteurs des ticks de la minuterie, par serveur */
  private timerListeners: TimerListener[] = [];

  @Inject logger!: LoggerService;
  @Inject resourcesService!: ResourcesService;

  public async init(client: Client): Promise<void> {
    await super.init(client);

    this.serviceState = new GuildResource({
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
  private getServiceState(guild: Guild): MassMultiplayerEventServiceState {
    const maybeState = this.serviceState.get(guild);
    if (!maybeState) {
      const initial = {
        running: false,
        textChannelIds: [],
        voiceChannelIds: [],
        groupStats: {},
      };
      void this.serviceState.set(guild, initial);
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
  public isEventRunning(guild: Guild): boolean {
    return this.getServiceState(guild).running;
  }

  /**
   * Permet de savoir si le canal indiqué est un canal créé pour un événement.
   *
   * @param guild Le serveur concerné
   * @param channel Le canal
   * @returns Vrai si le canal est un canal texte créé pour l'événement
   */
  public isGroupChannel(
    guild: Guild,
    channel: Channel
  ): channel is TextChannel {
    return (
      channel.isTextBased() &&
      this.getServiceState(guild).textChannelIds.includes(channel.id)
    );
  }

  /**
   * Créer les canaux texte et voix sur un serveur donné et pour un nombre de
   * groupes de joueurs donné.
   *
   * @param guild Le serveur concerné
   * @param numberOfGroups Le nombrre de groupes de joueurs
   * @returns Une promesse résolue quand tous les canaux sont créés.
   * @throws S'il y a déjà un événement en cours
   */
  public async startEvent(
    guild: Guild,
    categoryChannel: CategoryChannel,
    numberOfGroups: number
  ): Promise<void> {
    if (this.isEventRunning(guild))
      throw MassMultiplayerEventServiceError.eventAlready();

    const textChannelIds: string[] = [];
    const voiceChannelIds: string[] = [];
    const groupStats: { [groupId: string]: GroupStats } = {};
    for (let groupNumber = 1; groupNumber <= numberOfGroups; groupNumber++) {
      const groupChannel = await guild.channels.create({
        name: `groupe-${groupNumber}`,
        type: ChannelType.GuildText,
      });
      await groupChannel.setParent(categoryChannel);
      textChannelIds.push(groupChannel.id);

      const groupVoiceChannel = await guild.channels.create({
        name: `voice-groupe-${groupNumber}`,
        type: ChannelType.GuildVoice,
      });
      await groupVoiceChannel.setParent(categoryChannel);
      voiceChannelIds.push(groupVoiceChannel.id);

      groupStats[groupChannel.id] = {};
    }
    await this.serviceState.set(guild, {
      running: true,
      textChannelIds,
      voiceChannelIds,
      groupStats,
    });
  }

  /**
   * Supprimer pour un serveur donné tous les canaux ayant été créés pour les
   * besoins d'un événements multijoueurs.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois les canaux supprimés
   * @throws S'il n'y a pas d'événement en cours
   */
  public async endEvent(guild: Guild): Promise<void> {
    if (!this.isEventRunning(guild))
      throw MassMultiplayerEventServiceError.noEvent();

    const channelsId = [
      ...this.getServiceState(guild).textChannelIds,
      ...this.getServiceState(guild).voiceChannelIds,
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
    await this.serviceState.set(guild, {
      running: false,
      textChannelIds: [],
      voiceChannelIds: [],
      groupStats: {},
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
   * @throws S'il n'y a pas d'événement en cours
   */
  public async broadcastMessage(
    guild: Guild,
    messageOptions: MessageCreateOptions,
    excludeGroupIds?: string[]
  ): Promise<Message[]> {
    if (!this.isEventRunning(guild))
      throw MassMultiplayerEventServiceError.noEvent();

    let textChannelIds = this.getServiceState(guild).textChannelIds;
    if (excludeGroupIds) {
      textChannelIds = textChannelIds.filter(
        (id) => !excludeGroupIds.includes(id)
      );
    }

    const channels = textChannelIds.reduce((memo, groupId) => {
      const maybeChannel = guild.channels.cache.find(
        (channel) => channel.id === groupId
      );
      if (maybeChannel && maybeChannel.type === ChannelType.GuildText) {
        memo.push(maybeChannel);
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
   * Renvoie le nombre de minutes restantes.
   *
   * @param guild Le serveur concerné
   * @returns Le nombre de minutes restantes ou `undefined` si la minuterie n'a
   * pas été initialisée
   */
  public getTimeRemaining(guild: Guild): number | undefined {
    return this.getServiceState(guild).minutesRemaining;
  }

  /**
   * Démarre la minuterie sur le serveur concerné.
   *
   * @param guild Le serveur concerné
   * @param minutes Le nombre de minutes
   * @throws S'il y a déjà une minuterie en cours
   */
  public startTimer(guild: Guild, minutes: number): void {
    if (this.isTimerRunning(guild))
      throw MassMultiplayerEventServiceError.timerAlready();

    this.updateMinutesRemaining(guild, () => minutes);
    this.createTimerInterval(guild);
    this.emitTimerEvent(guild, "start");
  }

  /**
   * Permet de savoir si la minuterie court sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @returns Vrai si la minuterie est active
   */
  public isTimerRunning(guild: Guild): boolean {
    return !!this.timerByGuildId[guild.id];
  }

  /**
   * Permet de mettre en pause la minuterie sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @throws S'il n'y a pas de minuterie en cours
   */
  public pauseTimer(guild: Guild): void {
    if (this.timerByGuildId[guild.id]) {
      clearInterval(this.timerByGuildId[guild.id]);
      delete this.timerByGuildId[guild.id];
      this.emitTimerEvent(guild, "pause");
    } else {
      throw MassMultiplayerEventServiceError.noTimer();
    }
  }

  /**
   * Redémarre une minuterie mise en pause sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @throws S'il n'y a pas de minuterie à redémarrer
   * @throws S'il la minuterie n'a pas été initialisée
   */
  public resumeTimer(guild: Guild): void {
    if (this.isTimerRunning(guild))
      throw MassMultiplayerEventServiceError.timerAlready();

    if (!this.getServiceState(guild).minutesRemaining)
      throw MassMultiplayerEventServiceError.noMinutesRemaining();

    this.createTimerInterval(guild);
    this.emitTimerEvent(guild, "resume");
  }

  /**
   * Permet d'inscrire un écouteur à la minuterie.
   *
   * @param listener L'écouteur
   * @returns Une fonction permet de désinscrire l'écouteur
   */
  public addTimerListener(listener: TimerListener): () => void {
    this.timerListeners.push(listener);
    return () => this.removeTimerListener(listener);
  }

  /**
   * Permet de désinscrire un écouteur de la minuterie pour le serveur indiqué.
   *
   * @param listener L'écouteur à désinscrire
   */
  private removeTimerListener(listener: TimerListener): void {
    const idx = this.timerListeners.indexOf(listener);
    if (idx > -1) {
      this.timerListeners.splice(idx, 1);
    }
  }

  private emitTimerEvent(guild: Guild, event: TimerEvent): void {
    const minutesRemaining = this.getTimeRemaining(guild);
    this.timerListeners.forEach((listener) =>
      listener(guild, event, minutesRemaining)
    );
  }

  /**
   * Permet de mettre à jour le temps restant pour un serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @param updater Une fonction de mise à jour qui reçoit l'ancienne valeur
   * et renvoie la nouvelle
   */
  private updateMinutesRemaining(
    guild: Guild,
    updater: (oldValue: number | undefined) => number
  ): void {
    const state = this.getServiceState(guild);
    void this.serviceState.set(guild, {
      ...state,
      minutesRemaining: updater(state.minutesRemaining),
    });
  }

  /**
   * Mise de la routine nécessaire pour la minuterie.
   *
   * @param guild Le serveur concerné
   */
  private createTimerInterval(guild: Guild): void {
    this.timerByGuildId[guild.id] = setInterval(() => {
      this.updateMinutesRemaining(guild, (previousValue) => {
        if (previousValue !== undefined) return previousValue - 1;
        return 0; // Ne devrait pas arriver
      });
      const remaining = this.getServiceState(guild).minutesRemaining;
      if (remaining !== undefined) {
        this.emitTimerEvent(guild, "tick");
        if (remaining === 0) {
          clearInterval(this.timerByGuildId[guild.id]);
          delete this.timerByGuildId[guild.id];
          this.emitTimerEvent(guild, "ended");
        }
      }
    }, 1000 * 60);
  }

  /**
   * Met à jour une statistique pour un groupe de joueurs sur le serveur
   * indiqué.
   *
   * @param guild Le serveur concerné
   * @param channel Le canal du groupe de joueurs
   * @param statName Le nom de la statistique
   * @param updater Un fonction de mise à jour de la statistique
   * @throws S'il n'y a pas d'événement en cours
   */
  public async recordStat<T>(
    guild: Guild,
    channel: TextChannel,
    statName: string,
    updater: (oldValue: T) => T
  ): Promise<void> {
    if (!this.isEventRunning(guild))
      throw MassMultiplayerEventServiceError.noEvent();

    const state = this.getServiceState(guild);
    const groupStats = state.groupStats;
    const groupStatsForGroup = groupStats[channel.id];
    if (groupStatsForGroup) {
      const oldValue = groupStatsForGroup[statName];
      await this.serviceState.set(guild, {
        ...state,
        groupStats: {
          ...groupStats,
          [channel.id]: {
            ...groupStatsForGroup,
            [statName]: updater(oldValue as T),
          },
        },
      });
    }
  }

  /**
   * Récupère les statistiques par groupe pour un serveur donné.
   *
   * @param guild Le serveur concerné
   * @returns Les statistiques par groupe
   */
  public getStats(guild: Guild): { [groupId: string]: GroupStats } {
    return this.getServiceState(guild).groupStats;
  }
}

/** Les statistiques de l'événement pour un groupe donné */
type GroupStats = { [statName: string]: unknown };

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

  /** Temps restant en minutes */
  minutesRemaining?: number;

  /** Statistiques par groupe */
  groupStats: { [groupId: string]: GroupStats };
}

/**
 * Erreur spécifique au service de gestion des événements multijoueurs
 */
export class MassMultiplayerEventServiceError extends Error {
  /**
   * Créé une erreur d'absence d'événement en cours.
   *
   * @returns Une erreur d'absence d'événement en cours
   */
  public static noEvent(): MassMultiplayerEventServiceError {
    return new MassMultiplayerEventServiceError(
      "Il n'y a pas d'événement en cours"
    );
  }

  /**
   * Créé une erreur d'événement déjà en cours.
   *
   * @returns Une erreur d'événement déjà en cours
   */
  public static eventAlready(): MassMultiplayerEventServiceError {
    return new MassMultiplayerEventServiceError(
      "Il y a pas déjà un événement en cours"
    );
  }

  /**
   * Créé une erreur d'absence de minuterie en cours.
   *
   * @returns Une erreur d'absence de minuterie en cours
   */
  public static noTimer(): MassMultiplayerEventServiceError {
    return new MassMultiplayerEventServiceError(
      "Il n'y a pas de minuterie en cours"
    );
  }

  /**
   * Créé une erreur de minuterie déjà en cours.
   *
   * @returns Une erreur de minuterie déjà en cours
   */
  public static timerAlready(): MassMultiplayerEventServiceError {
    return new MassMultiplayerEventServiceError(
      "Il y a déjà une minuterie en cours"
    );
  }

  /**
   * Créé une erreur de minuterie non initialisée.
   *
   * @returns Une erreur de minuterie non initialisée
   */
  public static noMinutesRemaining(): MassMultiplayerEventServiceError {
    return new MassMultiplayerEventServiceError(
      "La minuterie n'a pas été initialisée"
    );
  }
}

/** Les types d'événement de la minuterie */
export type TimerEvent = "start" | "pause" | "resume" | "tick" | "ended";

/**
 * Le type d'un écouteur d'événement de la minuterie
 */
export interface TimerListener {
  (guild: Guild, event: TimerEvent, minutesRemaining: number | undefined): void;
}

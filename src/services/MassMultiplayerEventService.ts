import {
  CategoryChannel,
  Channel,
  Client,
  Guild,
  Message,
  MessageOptions,
  TextChannel,
} from "discord.js";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { LoggerService } from "./LoggerService";
import { GuildResource } from "./resources/GuildResource";
import { ResourcesService } from "./ResourcesService";

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

  /** Etat du service */
  private eventState!: GuildResource<MassMultiplayerEventServiceState>;

  /** Les timers (par serveur) permettant de gérer la minuterie */
  private timerByGuildId: { [guildId: string]: NodeJS.Timer } = {};

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
  public async startEvent(
    guild: Guild,
    categoryChannel: CategoryChannel,
    numberOfGroups: number
  ): Promise<void> {
    const textChannelIds: string[] = [];
    const voiceChannelIds: string[] = [];
    for (let groupNumber = 1; groupNumber <= numberOfGroups; groupNumber++) {
      const groupChannel = await guild.channels.create(
        `groupe-${groupNumber}`,
        {
          type: "GUILD_TEXT",
        }
      );
      await groupChannel.setParent(categoryChannel);
      textChannelIds.push(groupChannel.id);

      const groupVoiceChannel = await guild.channels.create(
        `voice-groupe-${groupNumber}`,
        {
          type: "GUILD_VOICE",
        }
      );
      await groupVoiceChannel.setParent(categoryChannel);
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
  public async endEvent(guild: Guild): Promise<void> {
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
   * Démarre la minuterie sur le serveur concerné.
   * Renverra faux si une minuterie est déjà en cours.
   *
   * @param guild Le serveur concerné
   * @param minutes Le nombre de minutes
   * @param tick Une fonction à exécuter à chaque minute écoulée
   * @returns Vrai si la minuterie a été démarré
   */
  public startTimer(
    guild: Guild,
    minutes: number,
    tick?: (remaining: number) => void
  ): boolean {
    if (this.isTimerRunning(guild)) return false;

    this.updateMinutesRemaining(guild, () => minutes);
    this.createTimerInterval(guild, tick);
    return true;
  }

  /**
   * Permet de savoi si la minuterie court sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @returns Vrai si la minuterie est active
   */
  public isTimerRunning(guild: Guild): boolean {
    return !!this.timerByGuildId[guild.id];
  }

  /**
   * Permet de mettre en pause la minuterie sur le serveur indiqué.
   * Renverra faux s'il n'y a pas de minuterie en cours.
   *
   * @param guild Le serveur concerné
   * @returns Vrai si la minuterie a été mise en pause
   */
  public pauseTimer(guild: Guild): boolean {
    if (this.timerByGuildId[guild.id]) {
      clearInterval(this.timerByGuildId[guild.id]);
      delete this.timerByGuildId[guild.id];
      return true;
    } else {
      return false;
    }
  }

  /**
   * Redémarre une minuterie mise en pause sur le serveur indiqué.
   * Renverra faux si il n'y a pas de minuterie en pause.
   *
   * @param guild Le serveur concerné
   * @param tick Une fonction à exécuter à chaque minute écoulée
   * @returns Vrai si une minuterie a été redémarrée
   */
  public resumeTimer(
    guild: Guild,
    tick?: (remaining: number) => void
  ): boolean {
    if (this.isTimerRunning(guild)) return false;

    this.createTimerInterval(guild, tick);
    return true;
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
    const state = this.getEventState(guild);
    void this.eventState.set(guild, {
      ...state,
      minutesRemaining: updater(state.minutesRemaining),
    });
  }

  /**
   * Mise de la routine nécessaire pour la minuterie.
   *
   * @param guild Le serveur concerné
   * @param tick Une fonction à exécuter à chaque minute écoulée
   */
  private createTimerInterval(
    guild: Guild,
    tick?: (remaining: number) => void
  ): void {
    this.timerByGuildId[guild.id] = setInterval(() => {
      this.updateMinutesRemaining(guild, (previousValue) => {
        if (previousValue !== undefined) return previousValue - 1;
        return 0; // Ne devrait pas arriver
      });
      const remaining = this.getEventState(guild).minutesRemaining;
      if (remaining !== undefined) {
        if (tick) tick(remaining);
        if (remaining === 0) {
          clearInterval(this.timerByGuildId[guild.id]);
          delete this.timerByGuildId[guild.id];
        }
      }
    }, 1000 * 60);
  }
}

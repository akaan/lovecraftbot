import {
  Channel,
  Client,
  EmbedFieldData,
  Guild,
  Message,
  MessageEmbed,
  TextChannel,
} from "discord.js";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";

import { BaseService } from "../base/BaseService";
import { BlobGame } from "../domain/BlobGame";

import { BlobGameFileRepository } from "./BlobGameFileRepository";
import { LoggerService } from "./LoggerService";
import { MassMultiplayerEventService } from "./MassMultiplayerEventService";
import { RandomService } from "./RandomService";
import { ResourcesService } from "./ResourcesService";

/**
 * Statistiques d'un groupe de joueurs lors d'une partie du Dévoreur
 */
interface BlobGameStats {
  /** Dégâts infligés */
  damageDealt: number;

  /** Indices ajoutés */
  numberOfCluesAdded: number;

  /** Contre-mesures dépensées */
  numberOfCounterMeasuresSpent: number;

  /** Contre-mesures ajoutées */
  numberOfCounterMeasuresAdded: number;
}

/** Dictionnaire de statistiques indexées par l'identifiant du groupe */
type BlobGameStatsByGroup = { [groupId: string]: BlobGameStats };

/**
 * Structure de sauvegarde de l'état du service BlobGameService pour un
 * serveur donné
 */
interface BlobGameServiceState {
  /** Statistiques par identifiants de groupe */
  stats?: BlobGameStatsByGroup;

  /** Temps restant en minutes */
  timer?: number;

  /** Identifiants des canaux et messages indiquant l'état de la partie */
  gameStateMessageIds?: { channelId: string; msgId: string }[];
}

/**
 * Fonction de comparaison permettant de classer les parties par date de
 * création descendante.
 *
 * @param bg1 Première partie à comparer
 * @param bg2 Seconde partie à comparer
 * @returns Le résultat de la comparaison des 2 parties
 */
const sortByDateDesc = (bg1: BlobGame, bg2: BlobGame) => {
  if (bg1.getDateCreated() < bg2.getDateCreated()) return 1;
  if (bg1.getDateCreated() > bg2.getDateCreated()) return -1;
  return 0;
};

/**
 * Sous-classe de `Error` pour les erreurs spécifiques au service
 * BlobGameService
 */
export class BlobGameServiceError extends Error {
  /**
   * Instancie une erreur indiquant qu'un événement est déjà en cours.
   *
   * @returns Une erreur d'événement en cours
   */
  public static eventAlreadyRunning(): BlobGameServiceError {
    return new this("il y a déjà un événement en cours");
  }

  /**
   * Instancie une erreur indiquant qu'il n'y a pas de partie en cours.
   *
   * @returns Une erreur de partie non commencée
   */
  public static noGame(): BlobGameServiceError {
    return new this("pas de partie en cours");
  }

  /**
   * Instancie une erreur indiquant que la minuterie de la partie n'est pas
   * démarrée.
   *
   * @returns Une erreur de minuterie non démarrée
   */
  public static noTimer(): BlobGameServiceError {
    return new this("impossible tant que la minuterie n'est pas démarrée");
  }

  /**
   * Instancie une erreur indiquant qu'il n'y a pas de minuterie à mettre en
   * pause.
   *
   * @returns Erreur de minuterie impossible à mettre en pause
   */
  public static noTimerToPause(): BlobGameServiceError {
    return new this("pas de minuterie en cours");
  }

  /**
   * Instancie une erreur indiquant qu'il n'y a actuellement pas de minuterie
   * en pause.
   *
   * @returns Erreur de minuterie non mise en pause
   */
  public static noTimerToResume(): BlobGameServiceError {
    return new this("pas de minuterie en pause");
  }

  /**
   * Instancie une erreur indiquant qu'il existe déjà une minuterie en cours.
   *
   * @returns Erreur de minuterie en cours
   */
  public static timerAlreadyRunning(): BlobGameServiceError {
    return new this("il y a déjà une minuterie en cours");
  }

  /**
   * Instancie une erreur indiquant qu'il n'est pas possible de poser plus de
   * 3 indices à la fois sur l'acte 1.
   *
   * @returns Erreur nombre d'indices trop élevé
   */
  public static tooMuchCluesAtOnce(): BlobGameServiceError {
    return new this(
      "impossible de placer plus de 3 indices à la fois sur l'Acte 1"
    );
  }

  /**
   * Instancie une erreur indiquant qu'il n'y a pas de client Discord.
   *
   * @returns Erreur de client Discord absent
   */
  public static noDiscordClient(): BlobGameServiceError {
    return new this("pas de client Discord disponible");
  }
}

@Singleton
@OnlyInstantiableByContainer
/**
 * Service permettant de gérer une partie multijoueurs du Dévoreur de Toute
 * Chose
 */
export class BlobGameService extends BaseService {
  /** Etiquette utilisée pour les logs de ce service */
  private static LOG_LABEL = "BlobGameService";

  /** Le fichier de sauvegarde de l'état du service */
  private static STATE_FILE_NAME = "blobGameServiceState.json";

  /** Les entrepôts de sauvegarde des parties, par serveur */
  private blobGameRepositoryByGuildId: {
    [guildId: string]: BlobGameFileRepository;
  } = {};

  /** Les parties en cours, par serveur */
  private currentGameByGuildId: { [guildId: string]: BlobGame } = {};

  /** Les statistiques de jeu, par serveur */
  private gameStatsByGuildId: { [guildId: string]: BlobGameStatsByGroup } = {};

  /** Les minuteries, par serveur */
  private gameTimerByGuildId: { [guildId: string]: number } = {};

  /** Les timers associés aux minuteries, par serveur */
  private gameTimeoutByGuildId: { [guildId: string]: NodeJS.Timeout } = {};

  /** Les messages présentant l'état de la partie, par seveur */
  private gameStateMessagesByGuildId: { [guildId: string]: Message[] } = {};

  @Inject private logger!: LoggerService;
  @Inject private randomService!: RandomService;
  @Inject private resourcesService!: ResourcesService;
  @Inject private massMultiplayerEventService!: MassMultiplayerEventService;

  public async init(client: Client): Promise<void> {
    await super.init(client);

    await Promise.all(
      client.guilds.cache.map((guild) => {
        return this.loadState(guild);
      })
    );

    await Promise.all(
      client.guilds.cache.map((guild) => {
        return this.continueLatestGame(guild);
      })
    );
  }

  /**
   * Permet de savoir si le canal indiqué est le canal d'administration des
   * événements multijoueurs.
   *
   * @param channel Le canal à évaluer
   * @returns Vrai si le canal est le canal d'administration des événements
   *          multijoueurs
   */
  public isAdminChannel(channel: Channel): boolean {
    return this.massMultiplayerEventService.isAdminChannel(channel);
  }

  /**
   * Permet de démarrer une nouvelle partie du Dévoreur de Toute Chose sur un
   * serveur donné.
   *
   * @param guild Le serveur concerné
   * @param numberOfPlayers Le nombre de joueurs
   * @param numberOfGroups Le nombre de groupes
   * @returns Une promesse résolue une fois la partie démarrée
   * @throws Si un événement multijoueurs est déjà en cours
   */
  public async startNewGame(
    guild: Guild,
    numberOfPlayers: number,
    numberOfGroups: number
  ): Promise<void> {
    if (this.massMultiplayerEventService.runningEvent(guild))
      return Promise.reject(BlobGameServiceError.eventAlreadyRunning());

    try {
      await this.massMultiplayerEventService.createGroupChannels(
        guild,
        numberOfGroups
      );

      const repository = this.getBlobGameRepository(guild);

      const nextId = await repository.nextId();
      const game = (this.currentGameByGuildId[guild.id] = new BlobGame(
        nextId,
        new Date(),
        numberOfPlayers
      ));
      game.initNumberOfCounterMeasure();
      const randomStory =
        BlobGame.POSSIBLE_STORIES[
          this.randomService.getRandomInt(
            0,
            BlobGame.POSSIBLE_STORIES.length - 1
          )
        ];
      game.chooseStory(randomStory);
      await repository.save(game);

      await this.publishGameState(guild);

      return;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * Permet de publier et d'épingler dans chaque canal de l'événement
   * multijoueurs un message présentant l'état de la partie. Ces messages
   * seront mis à jour à chaque changement d'état de la partie.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois les messages publiés
   */
  private async publishGameState(guild: Guild): Promise<void> {
    if (!(guild.id in this.currentGameByGuildId)) return;

    const gameStateEmbed = this.createGameStateEmbed(guild);
    if (gameStateEmbed) {
      this.gameStateMessagesByGuildId[guild.id] =
        await this.massMultiplayerEventService.broadcastMessage(guild, {
          embeds: [gameStateEmbed],
        });
      this.saveState(guild).catch((error) =>
        this.logger.error(
          BlobGameService.LOG_LABEL,
          "Erreur à la sauvegarde de l'état de la partie",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          { error }
        )
      );
    }

    this.gameStateMessagesByGuildId[guild.id].forEach((msg) => void msg.pin());
  }

  /**
   * Met à jour les messages présentant l'état de la partie.
   *
   * @param guild Le serveur concerné
   */
  private updateGameState(guild: Guild): void {
    if (!(guild.id in this.gameStateMessagesByGuildId)) return;

    const gameStateEmbed = this.createGameStateEmbed(guild);
    if (gameStateEmbed) {
      Promise.all(
        this.gameStateMessagesByGuildId[guild.id].map((msg) =>
          msg.edit({ embeds: [gameStateEmbed] })
        )
      ).catch((error) =>
        this.logger.error(
          BlobGameService.LOG_LABEL,
          "Erreur à la mise à jour des messages d'état de la partie",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          { error }
        )
      );
    }
  }

  /**
   * Démarre la minuterie pour le serveur concerné.
   *
   * @param guild Le serveur concerné
   */
  private setUpTimerInterval(guild: Guild): void {
    this.gameTimeoutByGuildId[guild.id] = setInterval(() => {
      if (guild.id in this.gameTimerByGuildId) {
        this.gameTimerByGuildId[guild.id] -= 1;
        this.saveState(guild).catch((error) =>
          this.logger.error(
            BlobGameService.LOG_LABEL,
            "Erreur à la sauvegarde de l'état de la partie",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            { error }
          )
        );
        this.updateGameState(guild);
        if (this.gameTimerByGuildId[guild.id] === 0) {
          this.timeIsUp(guild);
          this.clearTimerInterval(guild);
          return;
        }
        if (this.gameTimerByGuildId[guild.id] % 15 === 0) {
          this.tellTimeRemaining(guild);
        }
      }
    }, 1000 * 60);
  }

  /**
   * Arrête la minuterie sur le serveur concerné.
   *
   * @param guild Le serveur concerné
   */
  private clearTimerInterval(guild: Guild): void {
    if (guild.id in this.gameTimeoutByGuildId) {
      clearInterval(this.gameTimeoutByGuildId[guild.id]);
      delete this.gameTimeoutByGuildId[guild.id];
    }
  }

  /**
   * Envoie un message sur les canaux des joueurs pour indiquer que le temps est
   * écoulé.
   *
   * @param guild Le serveur concerné
   */
  private timeIsUp(guild: Guild): void {
    this.massMultiplayerEventService
      .broadcastMessage(guild, { content: "La partie est terminée !" })
      .catch((error) =>
        this.logger.error(
          BlobGameService.LOG_LABEL,
          "Erreur au broadcasting du message de fin de partie",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          { error }
        )
      );
  }

  /**
   * Envoie un message sur les canaux des joueurs pour indiquer le temps restant
   * pour la partie.
   *
   * @param guild Le serveur concerné
   */
  private tellTimeRemaining(guild: Guild): void {
    if (guild.id in this.gameTimerByGuildId) {
      this.massMultiplayerEventService
        .broadcastMessage(guild, {
          content: `Le temps passe ... il reste ${
            this.gameTimerByGuildId[guild.id]
          } minutes pour vaincre le Dévoreur`,
        })
        .catch((error) =>
          this.logger.error(
            BlobGameService.LOG_LABEL,
            "Erreur au broadcasting du message indiquant le temps restant",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            { error }
          )
        );
    }
  }

  /**
   * Initialise et démarre la minuterie sur un serveur donné.
   *
   * @param guild Le serveur concerné
   * @param minutes Le temps imparti
   * @throws Si une minuterie est déjà démarrée
   */
  public startTimer(guild: Guild, minutes: number): void {
    if (this.isTimerRunning(guild))
      throw BlobGameServiceError.timerAlreadyRunning();

    this.gameTimerByGuildId[guild.id] = minutes;
    this.setUpTimerInterval(guild);
    this.updateGameState(guild);
    this.saveState(guild).catch((error) =>
      this.logger.error(
        BlobGameService.LOG_LABEL,
        "Erreur à la sauvegarde de l'état de la partie",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { error }
      )
    );
  }

  /**
   * Met en pause la minuterie pour un serveur donné.
   *
   * @param guild Le serveur concerné
   * @throws S'il n'y a pas de minuterie à mette en pause
   */
  public pauseTimer(guild: Guild): void {
    if (!this.isTimerRunning(guild))
      throw BlobGameServiceError.noTimerToPause();

    this.clearTimerInterval(guild);
    this.updateGameState(guild);
  }

  /**
   * Redémarre la minuterie sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @throws S'il n'y a pas de minuterie à redémarrer
   */
  public resumeTimer(guild: Guild): void {
    if (this.isTimerRunning(guild) || !(guild.id in this.gameTimerByGuildId))
      throw BlobGameServiceError.noTimerToResume();

    this.setUpTimerInterval(guild);
    this.updateGameState(guild);
  }

  /**
   * Permet de savoir si une minuterie court sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @returns Vrai si une minuterie est lancée
   */
  private isTimerRunning(guild: Guild): boolean {
    return guild.id in this.gameTimeoutByGuildId;
  }

  /**
   * Permet de savoir si une partie du Dévoreur de toute chose est en cours sur
   * le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @returns Vrai si une partie est en cours
   */
  private isGameRunning(guild: Guild): boolean {
    return guild.id in this.currentGameByGuildId;
  }

  /**
   * Permet de créer un encart Discord d'affichage de l'état de la partie.
   *
   * @param guild Le serveur concerné
   * @returns Un encart d'affichage de l'état de la partie si une partie est en
   *          cours
   */
  private createGameStateEmbed(guild: Guild): MessageEmbed | undefined {
    if (!this.isGameRunning(guild)) return undefined;

    const game = this.currentGameByGuildId[guild.id];
    let minuterie = "Minuterie non initialisée";
    if (guild.id in this.gameTimerByGuildId) {
      minuterie = `${this.gameTimerByGuildId[guild.id]} minutes`;
      if (!(guild.id in this.gameTimeoutByGuildId)) {
        minuterie += " (en pause)";
      }
    }

    const embed = new MessageEmbed();

    embed.setTitle(
      `Le Dévoreur de Toute Chose - ${game
        .getDateCreated()
        .toLocaleDateString()}`
    );
    embed.setColor(0x67c355);
    embed.addFields([
      {
        name: "Nombre de joueurs",
        value: game.getNumberOfPlayers().toString(),
      },
      {
        name: "Points de vie restants / total",
        value: `${game.getBlobRemainingHealth()} / ${game.getBlobTotalHealth()}`,
      },
      {
        name: "Indices sur l'Acte 1",
        value: `${game.getNumberOfCluesOnAct1()} / ${game.getAct1ClueThreshold()}`,
      },
      {
        name: "Nombre de contre-mesures",
        value: game.getNumberOfCounterMeasures().toString(),
      },
      {
        name: "Temps restant",
        value: minuterie,
      },
    ]);

    return embed;
  }

  /**
   * Permet de créer un encart Discord d'affichage des statistiques d'une
   * partie sur un serveur donné.
   *
   * @param guild Le serveur concerné
   * @returns Un encart d'affichage des statistiques de la partie s'il y a bien
   *          une partie en cours
   */
  public createGameStatsEmbed(guild: Guild): MessageEmbed | undefined {
    if (!this.isGameRunning(guild)) return undefined;

    const game = this.currentGameByGuildId[guild.id];

    if (!this.gameStatsByGuildId[guild.id]) return undefined;
    const gameStats = this.gameStatsByGuildId[guild.id];

    const embed = new MessageEmbed();

    embed.setTitle(
      `Le Dévoreur de Toute Chose - ${game
        .getDateCreated()
        .toLocaleDateString()} - Statistiques`
    );
    embed.setColor(0x67c355);

    const fields: EmbedFieldData[] = Object.keys(gameStats).reduce(
      (memo, groupId) => {
        const group = this.client?.channels.cache.find(
          (channel) => channel.id === groupId
        );
        if (group) {
          const statsForGroup = gameStats[groupId];
          const fieldValue = [
            `Nombre de dégât(s): ${statsForGroup.damageDealt}`,
            `Nombre d'indice(s): ${statsForGroup.numberOfCluesAdded}`,
            `Nombre de contre-mesures ajoutée(s): ${statsForGroup.numberOfCounterMeasuresAdded}`,
            `Nombre de contre-mesures dépensée(s): ${statsForGroup.numberOfCounterMeasuresSpent}`,
          ].join("\n");
          memo.push({ name: (group as TextChannel).name, value: fieldValue });
        }
        return memo;
      },
      [] as EmbedFieldData[]
    );
    embed.addFields(fields);

    return embed;
  }

  /**
   * Met fin à la partie du Dévoreur de Toute Chose sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   */
  public async endGame(guild: Guild): Promise<void> {
    // Minuterie
    if (this.isTimerRunning(guild)) this.pauseTimer(guild);
    delete this.gameTimerByGuildId[guild.id];

    // Statistiques
    this.gameStatsByGuildId[guild.id] = {};

    // Messages d'état de la partie
    this.gameStateMessagesByGuildId[guild.id] = [];

    this.saveState(guild).catch((error) =>
      this.logger.error(
        BlobGameService.LOG_LABEL,
        "Erreur à la sauvegarde de l'état de la partie",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { error }
      )
    );

    // Partie
    const repository = this.getBlobGameRepository(guild);
    this.currentGameByGuildId[guild.id].endGame(new Date());
    await repository.save(this.currentGameByGuildId[guild.id]);
    delete this.currentGameByGuildId[guild.id];

    await this.massMultiplayerEventService.cleanGroupChannels(guild);
  }

  /**
   * Renvoie le nombre de points de vie restants au Dévoreur si une partie est
   * en cours su le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @returns Le nombre de points de vie restant (si une patie est en cours)
   */
  public getBlobRemainingHealth(guild: Guild): number | undefined {
    if (!this.currentGameByGuildId[guild.id]) return;
    return this.currentGameByGuildId[guild.id].getBlobRemainingHealth();
  }

  /**
   * Inflige le nombre de dégâts indiqué au Dévoreur pour une partie en cours
   * sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @param numberOfDamageDealt Le nombre de dégâts infligés
   * @param groupChannel Le canal du groupe de joueurs ayant infligé les dégâts
   * @returns Une promesse résolue une fois le traitement terminé
   * @throws Si il n'y a pas de partie en cours
   * @throws Si la minuterie n'est pas démarrée
   */
  public async dealDamageToBlob(
    guild: Guild,
    numberOfDamageDealt: number,
    groupChannel: TextChannel
  ): Promise<void> {
    if (!this.isGameRunning(guild))
      return Promise.reject(BlobGameServiceError.noGame());

    if (!this.isTimerRunning(guild))
      return Promise.reject(BlobGameServiceError.noTimer());

    this.currentGameByGuildId[guild.id].dealDamageToBlob(numberOfDamageDealt);
    this.recordStat(guild, groupChannel.id, "damageDealt", numberOfDamageDealt);
    await this.getBlobGameRepository(guild).save(
      this.currentGameByGuildId[guild.id]
    );
    this.updateGameState(guild);

    if (this.getBlobRemainingHealth(guild) === 0) {
      await groupChannel.send(
        `vous portez le coup fatal avec ${numberOfDamageDealt} infligé(s) ! Bravo !`
      );
      await this.massMultiplayerEventService.broadcastMessage(
        guild,
        {
          content: `${groupChannel.name} a porté le coup fatal en infligeant ${numberOfDamageDealt} dégât(s) au Dévoreur !`,
        },
        [groupChannel.id]
      );
      await this.gameWon(guild);
    } else {
      await this.massMultiplayerEventService.broadcastMessage(
        guild,
        {
          content: `${groupChannel.name} a infligé ${numberOfDamageDealt} dégât(s) au Dévoreur !`,
        },
        [groupChannel.id]
      );
    }
  }

  /**
   * Place le nombre d'indices indiqués sur l'Acte 1 sur la partie en cours du
   * serveur indiqué.
   *
   * @param guild Le serveur indiqué
   * @param numberOfClues Le nombre d'indices placés
   * @param groupChannel Le canal du groupe de joueurs ayant placé les indices
   * @returns Une promesse résolue une fois le traitement terminé
   * @throws Si il n'y a pas de partie en cours
   * @throws Si la minuterie n'est pas démarrée
   * @throws Si trop d'indices sont placés à la fois
   */
  public async placeCluesOnAct1(
    guild: Guild,
    numberOfClues: number,
    groupChannel: TextChannel
  ): Promise<void> {
    if (!this.isGameRunning(guild))
      return Promise.reject(BlobGameServiceError.noGame());

    if (!this.isTimerRunning(guild))
      return Promise.reject(BlobGameServiceError.noTimer());

    if (numberOfClues > 3)
      return Promise.reject(BlobGameServiceError.tooMuchCluesAtOnce());

    this.currentGameByGuildId[guild.id].placeCluesOnAct1(numberOfClues);
    this.updateGameState(guild);
    this.recordStat(
      guild,
      groupChannel.id,
      "numberOfCluesAdded",
      numberOfClues
    );
    await this.getBlobGameRepository(guild).save(
      this.currentGameByGuildId[guild.id]
    );

    await this.massMultiplayerEventService.broadcastMessage(
      guild,
      {
        content: `${groupChannel.name} a placé ${numberOfClues} indice(s) sur l'Acte 1 !`,
      },
      [groupChannel.id]
    );

    if (
      this.currentGameByGuildId[guild.id].getNumberOfCluesOnAct1() ===
      this.currentGameByGuildId[guild.id].getAct1ClueThreshold()
    ) {
      await this.massMultiplayerEventService.broadcastMessage(guild, {
        content: `Les investigateurs ont réunis l'ensemble des indices nécessaires. Dès le prochain round, vous pouvez faire avancer l'Acte 1.`,
      });
    }
  }

  /**
   * Permet d'indiquer que des contre-mesures ont été obtenues sur la partie en
   * cours du serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @param numberOfCounterMeasures Le nombre de contre-mesures obtenues
   * @param groupChannel Le canal du groupe de joueurs ayant obtenu les contre-mesures
   * @returns Une promesse résolue une fois le traitement terminé
   * @throws Si il n'y a pas de partie en cours
   * @throws Si la minuterie n'est pas démarrée
   */
  public async gainCounterMeasures(
    guild: Guild,
    numberOfCounterMeasures: number,
    groupChannel: TextChannel
  ): Promise<void> {
    if (!this.isGameRunning(guild))
      return Promise.reject(BlobGameServiceError.noGame());

    if (!this.isTimerRunning(guild))
      return Promise.reject(BlobGameServiceError.noTimer());

    this.currentGameByGuildId[guild.id].gainCounterMeasures(
      numberOfCounterMeasures
    );
    this.updateGameState(guild);
    this.recordStat(
      guild,
      groupChannel.id,
      "numberOfCounterMeasuresAdded",
      numberOfCounterMeasures
    );
    await this.getBlobGameRepository(guild).save(
      this.currentGameByGuildId[guild.id]
    );
    await this.massMultiplayerEventService.broadcastMessage(
      guild,
      {
        content: `${groupChannel.name} a ajouté ${numberOfCounterMeasures} contre-mesures(s) !`,
      },
      [groupChannel.id]
    );
  }

  /**
   * Permet d'indiquer que des contre-mesures ont été dépensées sur la partie en
   * cours sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @param numberOfCounterMeasures Le nombre de contre-mesures dépensées
   * @param groupChannel Le canal du groupe de joueurs ayant dépenser les contre-mesures
   * @returns Une promesse résolue une fois le traitement terminé
   * @throws Si il n'y a pas de partie en cours
   * @throws Si la minuterie n'est pas démarrée
   */
  public async spendCounterMeasures(
    guild: Guild,
    numberOfCounterMeasures: number,
    groupChannel: TextChannel
  ): Promise<void> {
    if (!this.isGameRunning(guild))
      return Promise.reject(BlobGameServiceError.noGame());

    if (!this.isTimerRunning(guild))
      return Promise.reject(BlobGameServiceError.noTimer());

    this.currentGameByGuildId[guild.id].spendCounterMeasures(
      numberOfCounterMeasures
    );
    this.updateGameState(guild);
    this.recordStat(
      guild,
      groupChannel.id,
      "numberOfCounterMeasuresSpent",
      numberOfCounterMeasures
    );
    await this.getBlobGameRepository(guild).save(
      this.currentGameByGuildId[guild.id]
    );
    await this.massMultiplayerEventService.broadcastMessage(
      guild,
      {
        content: `${groupChannel.name} a dépensé ${numberOfCounterMeasures} contre-mesures(s) !`,
      },
      [groupChannel.id]
    );
  }

  /**
   * Renvoie (instancie si nécessaire) l'entrepôt de sauvegarde des parties pour
   * le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @returns L'entrepôt de parties
   */
  private getBlobGameRepository(guild: Guild): BlobGameFileRepository {
    if (!this.blobGameRepositoryByGuildId[guild.id]) {
      this.blobGameRepositoryByGuildId[guild.id] = new BlobGameFileRepository(
        guild
      );
    }
    return this.blobGameRepositoryByGuildId[guild.id];
  }

  /**
   * Permet de reprendre une partie en cours sur le serveur indiqué. Cette
   * méthode est appelé à l'initialisation du service et permet de reprendre la
   * partie en cours au cas où le bot aurait été redémarré pendant la partie.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec la date de création de la partie si trouvée
   */
  private async continueLatestGame(guild: Guild): Promise<Date | undefined> {
    const repository = this.getBlobGameRepository(guild);

    const availableBlobGames = await repository.load();
    if (availableBlobGames.length === 0) return undefined;

    const runningGames = availableBlobGames.filter(
      (game) => typeof game.getDateEnded() === "undefined"
    );

    if (runningGames.length === 0) return undefined;

    this.currentGameByGuildId[guild.id] = runningGames.sort(sortByDateDesc)[0];
    this.updateGameState(guild);
    return this.currentGameByGuildId[guild.id].getDateCreated();
  }

  /**
   * Permet de mettre à jour les statistiques de la partie sur le serveur
   * indiqué.
   *
   * @param guild Le serveur concerné
   * @param groupId L'identifiant du groupe de joueurs ayant effectué une action
   * @param statName Le nom de la statistique
   * @param amount Le montant à ajouter à la statistique
   */
  private recordStat(
    guild: Guild,
    groupId: string,
    statName: keyof BlobGameStats,
    amount: number
  ): void {
    if (!this.gameStatsByGuildId[guild.id]) {
      this.gameStatsByGuildId[guild.id] = {};
    }
    if (!this.gameStatsByGuildId[guild.id][groupId]) {
      this.gameStatsByGuildId[guild.id][groupId] = {
        damageDealt: 0,
        numberOfCluesAdded: 0,
        numberOfCounterMeasuresAdded: 0,
        numberOfCounterMeasuresSpent: 0,
      };
    }

    this.gameStatsByGuildId[guild.id][groupId][statName] =
      this.gameStatsByGuildId[guild.id][groupId][statName] + amount;

    this.saveState(guild).catch((error) =>
      this.logger.error(
        BlobGameService.LOG_LABEL,
        "Erreur à la sauvegarde de l'état de la partie",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { error }
      )
    );
  }

  /**
   * Indique aux joueurs que la partie est terminée et publie les statistiques.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois le traitement terminé
   */
  private async gameWon(guild: Guild): Promise<void> {
    await this.massMultiplayerEventService.broadcastMessage(guild, {
      content: `Félications, vous avez vaincu le Dévoreur !`,
    });
    const statsEmbed = this.createGameStatsEmbed(guild);
    if (statsEmbed) {
      await this.massMultiplayerEventService.broadcastMessage(guild, {
        embeds: [statsEmbed],
      });
    }
  }

  /**
   * Charge l'état du service pour un serveur donné.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois le chargement terminé
   */
  private async loadState(guild: Guild): Promise<void> {
    try {
      if (
        await this.resourcesService.guildResourceExists(
          guild,
          BlobGameService.STATE_FILE_NAME
        )
      ) {
        const raw = await this.resourcesService.readGuildResource(
          guild,
          BlobGameService.STATE_FILE_NAME
        );
        if (raw) {
          const parsed = JSON.parse(raw) as BlobGameServiceState;
          if (parsed.stats) this.gameStatsByGuildId[guild.id] = parsed.stats;
          if (parsed.timer) this.gameTimerByGuildId[guild.id] = parsed.timer;
          if (parsed.gameStateMessageIds) {
            this.gameStateMessagesByGuildId[guild.id] = [];
            for (const { channelId, msgId } of parsed.gameStateMessageIds) {
              const msg = await getMessage(guild, channelId, msgId);
              if (msg) {
                this.gameStateMessagesByGuildId[guild.id].push(msg);
              }
            }
          }
        } else {
          this.gameStatsByGuildId[guild.id] = {};
        }
      }
    } catch (error) {
      this.logger.error(
        BlobGameService.LOG_LABEL,
        `Erreur au chargement d'état sur le serveur ${guild.name}`,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { error }
      );
    }
  }

  /**
   * Sauvegarde l'état du service pour un serveur donné.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois la sauvegarde effectuée
   */
  private async saveState(guild: Guild): Promise<void> {
    try {
      const state: BlobGameServiceState = {};
      if (guild.id in this.gameStatsByGuildId)
        state.stats = this.gameStatsByGuildId[guild.id];
      if (guild.id in this.gameTimerByGuildId)
        state.timer = this.gameTimerByGuildId[guild.id];
      if (guild.id in this.gameStateMessagesByGuildId)
        state.gameStateMessageIds = this.gameStateMessagesByGuildId[
          guild.id
        ].map((msg) => ({ channelId: msg.channel.id, msgId: msg.id }));

      await this.resourcesService.saveGuildResource(
        guild,
        BlobGameService.STATE_FILE_NAME,
        JSON.stringify(state, null, "  ")
      );
    } catch (error) {
      this.logger.error(
        BlobGameService.LOG_LABEL,
        `Erreur à la sauvegarde d'état sur le serveur ${guild.name}`,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { error }
      );
    }
  }
}

/**
 * Permet de récupérer un message (en vue de le mettre à jour) sur un serveur
 * donné en précisant son canal et son identifiant.
 *
 * @param guild Le serveur concerné
 * @param channelId L'identifiant du canal
 * @param msgId L'identifiant du message
 * @returns Une promesse résolue avec le message si trouvé
 */
async function getMessage(
  guild: Guild,
  channelId: string,
  msgId: string
): Promise<Message | undefined> {
  const channel = guild.channels.cache.find((c) => c.id === channelId);
  if (channel && channel.isText()) {
    try {
      return await channel.messages.fetch(msgId);
    } catch (err) {
      return undefined;
    }
  }
  return undefined;
}

import { APIEmbedField } from "discord-api-types/v10";
import { Client, EmbedBuilder, Guild, Message, TextChannel } from "discord.js";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";
import { BlobGame } from "../domain/BlobGame";
import { IBlobGameRepository } from "../domain/IBlobGameRepository";

import { BlobGameFileRepository } from "./BlobGameFileRepository";
import { LoggerService } from "./LoggerService";
import {
  MassMultiplayerEventService,
  TimerEvent,
} from "./MassMultiplayerEventService";
import { RandomService } from "./RandomService";
import { GuildResource } from "./resources/GuildResource";
import { ResourcesService } from "./ResourcesService";

/**
 * Service de gestion d'une partie du Dévoreur de Toute Chose.
 */
@Singleton
@OnlyInstantiableByContainer
export class BlobGameService extends BaseService {
  /** Etiquette utilisée pour les logs de ce service */
  private static LOG_LABEL = "BlobGameService";

  @Inject logger!: LoggerService;
  @Inject massMultiplayerEventService!: MassMultiplayerEventService;
  @Inject resourcesService!: ResourcesService;
  @Inject randomService!: RandomService;

  /** Les parties en cours par serveur */
  private currentGame: { [guildId: string]: BlobGame } = {};

  /** Les entrepôts de sauvegarde des parties, par serveur */
  private repository: { [guildId: string]: IBlobGameRepository } = {};

  /** Les messages d'état de la partie, par serveur */
  private gameStateMessages: { [guildId: string]: Message[] } = {};

  /** L'état du service */
  private serviceState!: GuildResource<BlobGameServiceState>;

  constructor() {
    super();
    this.massMultiplayerEventService.addTimerListener(
      this.onTimerEvent.bind(this)
    );
  }

  public async init(client: Client): Promise<void> {
    await super.init(client);

    this.serviceState = new GuildResource({
      client,
      filename: `blobGameService.json`,
      logLabel: BlobGameService.LOG_LABEL,
      logger: this.logger,
      resourcesService: this.resourcesService,
      onLoaded: () => {
        client.guilds.cache.forEach(
          (guild) => void this.continueLatestGame(guild)
        );
      },
    });

    client.on("guildCreate", (guild) => this.continueLatestGame(guild));
  }

  /**
   * Permet de savoir si une partie du Dévoreur est en cours sur le serveur
   * indiqué.
   *
   * @param guild Le serveur concerné
   * @returns Vrai si une partie est en cours
   */
  public isGameRunning(guild: Guild): boolean {
    return guild.id in this.currentGame;
  }

  //#region Administration de la partie

  /**
   * Démarre une nouvelle partie du Dévorreur de Toute Chose.
   *
   * @param guild Le serveur concerné
   * @param numberOfPlayers Le nombre de joueurs
   * @throws Si une partie est déjà en cours
   * @throws S'il n'y a pas d'événement en cours
   */
  public async startNewGame(
    guild: Guild,
    numberOfPlayers: number
  ): Promise<void> {
    if (this.isGameRunning(guild))
      throw BlobGameServiceError.gameAlreadyRunning();
    if (!this.massMultiplayerEventService.isEventRunning(guild))
      throw BlobGameServiceError.noEvent();

    const repository = this.getRepository(guild);
    const nextId = await repository.nextId();
    const newGame = new BlobGame(nextId, new Date(), numberOfPlayers);
    await repository.save(newGame);
    this.setCurrentGame(guild, newGame);

    await this.publishOrUpdateGameState(guild);
  }

  /**
   * Met fin à la partie en cours sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @throws S'il n'y a pas de partie en cours
   */
  public async endGame(guild: Guild): Promise<void> {
    if (!this.isGameRunning(guild)) throw BlobGameServiceError.noGame();

    const repository = this.getRepository(guild);
    const game = this.getCurrentGame(guild) as BlobGame;
    game.endGame(new Date());
    await repository.save(game);
    this.eraseCurrentGame(guild);
    this.setGameStateMessages(guild, []);
  }

  /**
   * Corrige le nombre d'indices sur l'acte 1.
   *
   * @param guild Le serveur concerné
   * @param numberOfCluesOnAct1 Le nombre d'indices
   * @throws S'il n'y a pas de partie en cours
   */
  public async fixNumberOfCluesOnAct1(
    guild: Guild,
    numberOfCluesOnAct1: number
  ): Promise<void> {
    if (!this.isGameRunning(guild)) throw BlobGameServiceError.noGame();

    const repository = this.getRepository(guild);
    const game = this.getCurrentGame(guild) as BlobGame;
    game.setCluesOnAct1(numberOfCluesOnAct1);
    await repository.save(game);

    await this.publishOrUpdateGameState(guild);
  }

  /**
   * Corrige le nombre de contre-mesures.
   *
   * @param guild Le serveur concerné
   * @param numberOfCounterMeasures Le nombre de contre-mesures
   * @throws S'il n'y a pas de partie en cours
   */
  public async fixNumberOfCounterMeasures(
    guild: Guild,
    numberOfCounterMeasures: number
  ): Promise<void> {
    if (!this.isGameRunning(guild)) throw BlobGameServiceError.noGame();

    const repository = this.getRepository(guild);
    const game = this.getCurrentGame(guild) as BlobGame;
    game.setNumberOfCounterMeasures(numberOfCounterMeasures);
    await repository.save(game);

    await this.publishOrUpdateGameState(guild);
  }

  /**
   * Corrige le nombre de dégâts sur le Dévoreur.
   *
   * @param guild Le serveur concerné
   * @param numberOfDamage Le nombre de dégâts
   * @throws S'il n'y a pas de partie en cours
   */
  public async fixNumberOfDamageDealtToBlob(
    guild: Guild,
    numberOfDamage: number
  ): Promise<void> {
    if (!this.isGameRunning(guild)) throw BlobGameServiceError.noGame();

    const repository = this.getRepository(guild);
    const game = this.getCurrentGame(guild) as BlobGame;
    game.setNumberOfDamageDealtToBlob(numberOfDamage);
    await repository.save(game);

    await this.publishOrUpdateGameState(guild);
  }

  //#endregion

  //#region Commandes joueurs
  /**
   * Place des indices sur l'acte 1 sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @param numberOfCluesOnAct1 Le nombre d'indices
   * @throws S'il n'y a pas de partie en cours
   * @throws Si la minuterie n'est pas active
   * @throws Si trop d'indices sont posés à la fois
   */
  public async placeCluesOnAct1(
    guild: Guild,
    channel: TextChannel,
    numberOfClues: number
  ): Promise<void> {
    if (!this.isGameRunning(guild)) throw BlobGameServiceError.noGame();
    if (!this.massMultiplayerEventService.isTimerRunning(guild))
      throw BlobGameServiceError.noRunningTimer();
    if (numberOfClues > 3) throw BlobGameServiceError.tooMuchCluesAtOnce();

    const repository = this.getRepository(guild);
    const game = this.getCurrentGame(guild) as BlobGame;
    game.placeCluesOnAct1(numberOfClues);
    await repository.save(game);

    await this.massMultiplayerEventService.broadcastMessage(
      guild,
      {
        content: `${channel.name} a placé ${numberOfClues} indice(s) sur l'Acte 1 !`,
      },
      [channel.id]
    );

    await this.massMultiplayerEventService.recordStat<number>(
      guild,
      channel,
      "numberOfClues",
      (oldNumberOfClues) => {
        if (oldNumberOfClues === undefined) {
          return numberOfClues;
        } else {
          return oldNumberOfClues + numberOfClues;
        }
      }
    );

    if (game.getNumberOfCluesOnAct1() >= game.getAct1ClueThreshold()) {
      game.chooseStory(
        BlobGame.POSSIBLE_STORIES[
          this.randomService.getRandomInt(
            0,
            BlobGame.POSSIBLE_STORIES.length - 1
          )
        ]
      );
      await repository.save(game);
      await this.massMultiplayerEventService.broadcastMessage(guild, {
        content: `Les investigateurs ont réunis l'ensemble des indices nécessaires. Dès le prochain round, vous pouvez faire avancer l'Acte 1.`,
      });
    }

    await this.publishOrUpdateGameState(guild);
  }

  /**
   * Indique que des contre-mesures ont été obtenues sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @param numberOfCounterMeasures Le nombre de contre-mesures
   * @throws S'il n'y a pas de partie en cours
   * @throws Si la minuterie n'est pas active
   */
  public async gainCounterMeasures(
    guild: Guild,
    channel: TextChannel,
    numberOfCounterMeasures: number
  ): Promise<void> {
    if (!this.isGameRunning(guild)) throw BlobGameServiceError.noGame();
    if (!this.massMultiplayerEventService.isTimerRunning(guild))
      throw BlobGameServiceError.noRunningTimer();

    const repository = this.getRepository(guild);
    const game = this.getCurrentGame(guild) as BlobGame;
    game.gainCounterMeasures(numberOfCounterMeasures);
    await repository.save(game);

    await this.massMultiplayerEventService.broadcastMessage(
      guild,
      {
        content: `${channel.name} a ajouté ${numberOfCounterMeasures} contre-mesure(s) !`,
      },
      [channel.id]
    );

    await this.massMultiplayerEventService.recordStat<number>(
      guild,
      channel,
      "numberOfCounterMeasuresGained",
      (oldNumberOfCounterMeasures) => {
        if (oldNumberOfCounterMeasures === undefined) {
          return numberOfCounterMeasures;
        } else {
          return oldNumberOfCounterMeasures + numberOfCounterMeasures;
        }
      }
    );

    await this.publishOrUpdateGameState(guild);
  }

  /**
   * Permet de savoir s'il est possible de dépenser ce nombre de contre-mesures
   * sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @param numberOfCounterMeasures Le nombre de contre-mesures
   * @throws S'il n'y a pas de partie en cours
   */
  public canSpendCounterMeasure(
    guild: Guild,
    numberOfCounterMeasures: number
  ): boolean {
    if (!this.isGameRunning(guild)) throw BlobGameServiceError.noGame();

    const game = this.getCurrentGame(guild) as BlobGame;
    return numberOfCounterMeasures <= game.getNumberOfCounterMeasures();
  }

  /**
   * Indique que des contre-mesures ont été dépensées sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @param numberOfCounterMeasures Le nombre de contre-mesures
   * @throws S'il n'y a pas de partie en cours
   * @throws Si la minuterie n'est pas active
   * @throws S'il n'y a pas assez de contre-mesures
   */
  public async spendCounterMeasures(
    guild: Guild,
    channel: TextChannel,
    numberOfCounterMeasures: number
  ): Promise<void> {
    if (!this.isGameRunning(guild)) throw BlobGameServiceError.noGame();
    if (!this.massMultiplayerEventService.isTimerRunning(guild))
      throw BlobGameServiceError.noRunningTimer();

    const repository = this.getRepository(guild);
    const game = this.getCurrentGame(guild) as BlobGame;
    if (numberOfCounterMeasures > game.getNumberOfCounterMeasures()) {
      throw BlobGameServiceError.notEnoughCounterMeasures();
    }

    game.spendCounterMeasures(numberOfCounterMeasures);
    await repository.save(game);

    await this.massMultiplayerEventService.broadcastMessage(
      guild,
      {
        content: `${channel.name} a dépensé ${numberOfCounterMeasures} contre-mesure(s) !`,
      },
      [channel.id]
    );

    await this.massMultiplayerEventService.recordStat<number>(
      guild,
      channel,
      "numberOfCounterMeasuresSpend",
      (oldNumberOfCounterMeasures) => {
        if (oldNumberOfCounterMeasures === undefined) {
          return numberOfCounterMeasures;
        } else {
          return oldNumberOfCounterMeasures + numberOfCounterMeasures;
        }
      }
    );

    await this.publishOrUpdateGameState(guild);
  }

  /**
   * Inflige des dégâts au Dévoreur sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @param numberOfCluesOnAct1 Le nombre d'indices
   * @throws S'il n'y a pas de partie en cours
   * @throws Si la minuterie n'est pas active
   */
  public async dealDamageToBlob(
    guild: Guild,
    channel: TextChannel,
    numberOfDamageDealtToBlob: number
  ): Promise<void> {
    if (!this.isGameRunning(guild)) throw BlobGameServiceError.noGame();
    if (!this.massMultiplayerEventService.isTimerRunning(guild))
      throw BlobGameServiceError.noRunningTimer();

    const repository = this.getRepository(guild);
    const game = this.getCurrentGame(guild) as BlobGame;
    game.dealDamageToBlob(numberOfDamageDealtToBlob);
    await repository.save(game);

    await this.massMultiplayerEventService.recordStat<number>(
      guild,
      channel,
      "numberOfDamageDealtToBlob",
      (oldNumberOfDamageDealtToBlob) => {
        if (oldNumberOfDamageDealtToBlob === undefined) {
          return numberOfDamageDealtToBlob;
        } else {
          return oldNumberOfDamageDealtToBlob + numberOfDamageDealtToBlob;
        }
      }
    );

    if (game.getBlobRemainingHealth() === 0) {
      await this.massMultiplayerEventService.broadcastMessage(guild, {
        content: `${channel.name} a porté le coup fatal en infligeant ${numberOfDamageDealtToBlob} dégât(s) au Dévoreur !`,
      });
      this.publishGameStats(guild);
    } else {
      await this.massMultiplayerEventService.broadcastMessage(
        guild,
        {
          content: `${channel.name} a infligé ${numberOfDamageDealtToBlob} dégâts(s) au Dévoreur !`,
        },
        [channel.id]
      );
    }

    await this.publishOrUpdateGameState(guild);
  }

  /**
   * Renvoie l'histoire sélectionnée pour la partie, s'il y en a une, sur le
   * serveur indiqué.
   *
   * @param guild Le serrveur concerné
   * @returns L'histoire sélectionnée pour la partie
   */
  public getStory(guild: Guild): string | undefined {
    if (!this.isGameRunning(guild)) throw BlobGameServiceError.noGame();

    const game = this.getCurrentGame(guild) as BlobGame;
    return game.getStory();
  }
  //#endregion

  /**
   * Récupère l'état du service pour le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @returns L'état du service
   */
  private getServiceState(guild: Guild): BlobGameServiceState {
    const state = this.serviceState.get(guild);
    if (!state) {
      const initial = {
        gameStateMessages: [],
      };
      void this.serviceState.set(guild, initial);
      return initial;
    }
    return state;
  }

  /**
   * Met à jour l'état du service pour le seveur indiqué.
   *
   * @param guild Le serveur concerné
   * @param state Le nouvel état
   */
  private setServiceState(guild: Guild, state: BlobGameServiceState): void {
    void this.serviceState.set(guild, state);
  }

  /**
   * Récupère l'entrepôt de sauvegarde des parties pour le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @returns L'entrepôt de sauvegarde
   */
  private getRepository(guild: Guild): IBlobGameRepository {
    if (!(guild.id in this.repository)) {
      this.repository[guild.id] = new BlobGameFileRepository(guild);
    }
    return this.repository[guild.id];
  }

  /**
   * Renvoie la partie en cours pour le serveur indiqué s'il y en a une.
   *
   * @param guild Le serveur concerné
   * @returns La partie en cours ou `undefined` s'il n'y en a pas
   */
  private getCurrentGame(guild: Guild): BlobGame | undefined {
    return this.currentGame[guild.id];
  }

  /**
   * Positionner la partie en cours sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @param game La partie
   */
  private setCurrentGame(guild: Guild, game: BlobGame): void {
    this.currentGame[guild.id] = game;
  }

  /**
   * Efface la partie en cours pour le serveur indiqué.
   *
   * @param guild Le serveur concerné
   */
  private eraseCurrentGame(guild: Guild): void {
    delete this.currentGame[guild.id];
  }

  /**
   * Reprend la partie en cours s'il y en a une.
   *
   * @param guild Le serveur concerné
   */
  private async continueLatestGame(guild: Guild): Promise<void> {
    const repository = this.getRepository(guild);

    const allGames = await repository.load();
    if (allGames.length === 0) return;

    const runningGames = allGames.filter(
      (game) => game.getDateEnded() === undefined
    );
    if (runningGames.length === 0) return;

    const latestGame = runningGames.sort(sortByDateDesc)[0];
    this.logger.warn(BlobGameService.LOG_LABEL, `Reprise d'une partie`, {
      guild: guild.name,
      gameCreated: latestGame.getDateCreated().toLocaleString(),
    });
    this.setCurrentGame(guild, latestGame);

    const state = this.getServiceState(guild);
    if (state.gameStateMessages.length > 0) {
      const stateMessages = (
        await Promise.all(
          state.gameStateMessages.map(({ channelId, msgId }) =>
            getMessage(guild, channelId, msgId)
          )
        )
      ).filter((msg) => msg !== undefined) as Message[];
      this.setGameStateMessages(guild, stateMessages);
    }
  }

  /**
   * Récupère les messages d'état de la partie pour le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @returns La liste des messages
   */
  private getGameStateMessages(guild: Guild): Message[] {
    if (!(guild.id in this.gameStateMessages)) {
      this.gameStateMessages[guild.id] = [];
    }
    return this.gameStateMessages[guild.id];
  }

  /**
   * Positionne les messages d'état de la partie pour le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @param messages Les messages d'état de la partie
   */
  private setGameStateMessages(guild: Guild, messages: Message[]): void {
    this.gameStateMessages[guild.id] = messages;
    this.setServiceState(guild, {
      gameStateMessages: messages.map((msg) => ({
        channelId: msg.channelId,
        msgId: msg.id,
      })),
    });
  }

  /**
   * Créé ou met à jour les messages indiquant l'état de la partie.
   *
   * @param guild Le serveur concerné
   * @returns Une promess résolue une fois le messages créés ou mis à jour
   */
  private async publishOrUpdateGameState(guild: Guild): Promise<void> {
    if (
      !(
        this.massMultiplayerEventService.isEventRunning(guild) &&
        this.isGameRunning(guild)
      )
    )
      return;

    const game = this.getCurrentGame(guild) as BlobGame;

    const stateEmbed = createGameStateEmbed(
      game,
      this.massMultiplayerEventService.getTimeRemaining(guild),
      this.massMultiplayerEventService.isTimerRunning(guild)
    );

    const existingStateMessages = this.getGameStateMessages(guild);

    if (existingStateMessages.length === 0) {
      const stateMessages =
        await this.massMultiplayerEventService.broadcastMessage(guild, {
          embeds: [stateEmbed],
        });
      await Promise.all(stateMessages.map((msg) => msg.pin()));
      this.setGameStateMessages(guild, stateMessages);
    } else {
      await Promise.all(
        existingStateMessages.map((msg) => msg.edit({ embeds: [stateEmbed] }))
      );
    }
  }

  /**
   * Publie les statistiques de la partie sur le serveur indiqué.
   *
   * @param guild Le serveur concerné
   */
  private publishGameStats(guild: Guild): void {
    const game = this.getCurrentGame(guild);
    if (game) {
      const gameStats = this.massMultiplayerEventService.getStats(guild);
      const gameStatsWithGroupNames: BlobGameStats = Object.entries(
        gameStats
      ).reduce((memo, [groupId, groupStats]) => {
        const groupChannel = guild.channels.cache.find((c) => c.id === groupId);
        if (groupChannel) {
          memo[groupChannel.name] = groupStats;
        }
        return memo;
      }, {} as BlobGameStats);

      const statsEmbed = createGameStatsEmbed(game, gameStatsWithGroupNames);
      void this.massMultiplayerEventService.broadcastMessage(guild, {
        embeds: [statsEmbed],
      });
    }
  }

  /**
   * Met à jour l'état de la partie sur les événements de la minuterie.
   *
   * @param guild Le serveur concerné
   * @param _event L'événement de minuterie
   * @param _minutesRemaining Le temps restant
   */
  private onTimerEvent(
    guild: Guild,
    _event: TimerEvent,
    _minutesRemaining: number | undefined
  ): void {
    void this.publishOrUpdateGameState(guild);
  }
}

interface BlobGameServiceState {
  /** Les identifiants des messages présentant l'état de la partie */
  gameStateMessages: { channelId: string; msgId: string }[];
}

/**
 * Erreur spécifique au service de gestion d'une partie du Dévoreur de Toute
 * Chose.
 */
export class BlobGameServiceError extends Error {
  /**
   * Créé une erreur d'absence d'événement en cours.
   *
   * @returns Une erreur d'absence d'événement en cours
   */
  public static noEvent(): BlobGameServiceError {
    return new BlobGameServiceError("Pas d'événement en cours");
  }

  /**
   * Créé une erreur de partie déjà cours.
   *
   * @returns Une erreur de partie déjà en cours
   */
  public static gameAlreadyRunning(): BlobGameServiceError {
    return new BlobGameServiceError("Il y a déjà une partie en cours");
  }

  /**
   * Créé une erreur d'absence de partie.
   *
   * @returns Une erreur d'absence de partie
   */
  public static noGame(): BlobGameServiceError {
    return new BlobGameServiceError("Pas de partie en cours");
  }

  /**
   * Créé une erreur d'action impossible hors minuterie active.
   *
   * @returns Une erreur d'action impossible hors minuterie active
   */
  public static noRunningTimer(): BlobGameServiceError {
    return new BlobGameServiceError("Action impossible hors minuterie active");
  }

  /**
   * Créé une erreur de pose d'indices en trop.
   *
   * @returns Une erreur de pose d'indices en trop
   */
  public static tooMuchCluesAtOnce(): BlobGameServiceError {
    return new BlobGameServiceError(
      "Impossible de placer plus de 3 indices en 1 seule fois"
    );
  }

  /**
   * Créé une erreur de nombre de contre-mesures insuffisant.
   *
   * @returns Une erreur de nombre de contre-mesures insuffisant
   */
  public static notEnoughCounterMeasures(): BlobGameServiceError {
    return new BlobGameServiceError("Pas assez de contre-mesures disponibles");
  }
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
 * Permet de créer un encart Discord d'affichage de l'état de la partie.
 *
 * @param game La partie du Dévoreur
 * @param minutesRemaining Le temps restant (`undefined` si non initialisé)
 * @param isTimerRunning Si la minuterie est active
 * @returns Un encart d'affichage de l'état de la partie si une partie est en
 * cours
 */
function createGameStateEmbed(
  game: BlobGame,
  minutesRemaining: number | undefined,
  isTimerRunning: boolean
): EmbedBuilder {
  const embed = new EmbedBuilder();

  embed.setTitle(
    `Le Dévoreur de Toute Chose - ${game.getDateCreated().toLocaleDateString()}`
  );
  embed.setThumbnail(
    `https://images-cdn.fantasyflightgames.com/filer_public/ce/57/ce570809-b79c-46fe-a0a8-e10ef8d54328/ahc45_preview1.png`
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
      value: minutesRemaining
        ? `${minutesRemaining} minutes${isTimerRunning ? "" : " (en pause)"}`
        : `Minuterie non initialisée`,
    },
  ]);

  return embed;
}

type BlobGameStats = { [groupName: string]: { [statName: string]: unknown } };

/**
 * Permet de créer un encart Discord d'affichage des statistiques d'une
 * partie sur un serveur donné.
 *
 * @param game La partie du Dévoreur
 * @param gameStats Les statistiques
 * @returns Un encart d'affichage des statistiquesde la partie
 */
function createGameStatsEmbed(
  game: BlobGame,
  gameStats: BlobGameStats
): EmbedBuilder {
  const embed = new EmbedBuilder();

  embed.setTitle(
    `Le Dévoreur de Toute Chose - ${game
      .getDateCreated()
      .toLocaleDateString()} - Statistiques`
  );
  embed.setThumbnail(
    `https://images-cdn.fantasyflightgames.com/filer_public/ce/57/ce570809-b79c-46fe-a0a8-e10ef8d54328/ahc45_preview1.png`
  );
  embed.setColor(0x67c355);

  const fields: APIEmbedField[] = Object.keys(gameStats).reduce(
    (memo, groupName) => {
      const statsForGroup = gameStats[groupName];
      const fieldValue = [
        `Nombre de dégât(s): ${
          (statsForGroup["numberOfDamageDealtToBlob"] as number) || 0
        }`,
        `Nombre d'indice(s): ${
          (statsForGroup["numberOfClues"] as number) || 0
        }`,
        `Nombre de contre-mesures ajoutée(s): ${
          (statsForGroup["numberOfCounterMeasuresGained"] as number) || 0
        }`,
        `Nombre de contre-mesures dépensée(s): ${
          (statsForGroup["numberOfCounterMeasuresSpend"] as number) || 0
        }`,
      ].join("\n");
      memo.push({ name: groupName, value: fieldValue });
      return memo;
    },
    [] as APIEmbedField[]
  );
  embed.addFields(fields);

  return embed;
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
  if (channel && channel.isTextBased()) {
    try {
      return await channel.messages.fetch(msgId);
    } catch (err) {
      return undefined;
    }
  }
  return undefined;
}

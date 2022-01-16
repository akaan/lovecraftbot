import { Client, Guild } from "discord.js";
import { Inject } from "typescript-ioc";

import { BaseService } from "../base/BaseService";
import { BlobGame } from "../domain/BlobGame";
import { IBlobGameRepository } from "../domain/IBlobGameRepository";

import { BlobGameFileRepository } from "./BlobGameFileRepository";
import { LoggerService } from "./LoggerService";
import { MassMultiplayerEventService } from "./MassMultiplayerEventService";

/**
 * Service de gestion d'une partie du Dévoreur de Toute Chose.
 */
export class BlobGameService extends BaseService {
  @Inject logger!: LoggerService;
  @Inject massMultiplayerEventService!: MassMultiplayerEventService;

  /** Les parties en cours par serveur */
  private currentGame: { [guildId: string]: BlobGame } = {};

  /** Les entrepôts de sauvegarde des parties, par serveur */
  private repository: { [guildId: string]: IBlobGameRepository } = {};

  public async init(client: Client): Promise<void> {
    await super.init(client);
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
}

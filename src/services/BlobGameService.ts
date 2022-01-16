import { Client, Guild } from "discord.js";
import { Inject } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { LoggerService } from "./LoggerService";
import { MassMultiplayerEventService } from "./MassMultiplayerEventService";

/**
 * Service de gestion d'une partie du Dévoreur de Toute Chose.
 */
export class BlobGameService extends BaseService {
  @Inject logger!: LoggerService;
  @Inject massMultiplayerEventService!: MassMultiplayerEventService;

  public async init(client: Client): Promise<void> {
    await super.init(client);
  }

  /**
   * Démarre une nouvelle partie du Dévorreur de Toute Chose.
   *
   * @param guild Le serveur concerné
   * @param numberOfPlayers Le nombre de joueurs
   */
  public startNewGame(guild: Guild, _numberOfPlayers: number): Promise<void> {
    if (!this.massMultiplayerEventService.isEventRunning(guild))
      throw BlobGameServiceError.noEvent();
    return Promise.resolve();
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
}

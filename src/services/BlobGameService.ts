import { Client, Guild } from "discord.js";
import { Inject } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { LoggerService } from "./LoggerService";

export class BlobGameService extends BaseService {
  @Inject logger!: LoggerService;

  public async init(client: Client): Promise<void> {
    await super.init(client);
  }

  /**
   * Démarre une nouvelle partie du Dévorreur de Toute Chose.
   *
   * @param guild Le serveur concerné
   * @param numberOfPlayers Le nombre de joueurs
   */
  public startNewGame(_guild: Guild, _numberOfPlayers: number): Promise<void> {
    return Promise.resolve();
  }
}

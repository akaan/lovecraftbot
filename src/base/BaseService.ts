import { Client } from "discord.js";

import { IService } from "../interfaces";

/**
 * Classe de base pour un service utilisé par le bot.
 */
export class BaseService implements IService {
  /** Le client Discord */
  protected client?: Client;

  public init(client: Client): Promise<void> {
    this.client = client;
    return Promise.resolve();
  }

  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

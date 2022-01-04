import { Client } from "discord.js";

import { IService } from "../interfaces";

/**
 * Classe de base pour un service utilisé par le bot.
 */
export class BaseService implements IService {
  /** Le client Discord */
  protected client?: Client;

  /**
   * Initialise le service en lui fournissant le client Discord.
   *
   * @param client Le client Discord
   * @returns Une promesse résolue une fois l'initialisation terminée
   */
  public init(client: Client): Promise<void> {
    this.client = client;
    return Promise.resolve();
  }

  /**
   * Méthode appelée pour opermettre au service de s'arrêter proprement.
   *
   * @returns Une promesse résolue une fois l'arrêt terminée
   */
  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

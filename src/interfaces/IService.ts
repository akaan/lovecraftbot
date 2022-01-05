import * as Discord from "discord.js";

/**
 * Interface d'un service utilisé par le bot.
 */
export interface IService {
  /**
   * Initialise le service en lui fournissant le client Discord.
   *
   * @param client Le client Discord
   * @returns Une promesse résolue une fois l'initialisation terminée
   */
  init(client: Discord.Client): Promise<void>;

  /**
   * Méthode appelée pour permettre au service de s'arrêter proprement.
   *
   * @returns Une promesse résolue une fois l'arrêt terminée
   */
  shutdown(): Promise<void>;
}

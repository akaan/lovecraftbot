import * as Discord from "discord.js";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { EnvService } from "./EnvService";
import { RandomService } from "./RandomService";

/**
 * La liste des jeux de la gamme Horreur à Arkham
 */
const GAMES = [
  "Horreur à Arkham JCE",
  "Les Demeures de l'Épouvante",
  "L'Insondable",
  "Horreur à Arkham",
  "Les Contrées de l'Horreur",
  "Dernière Heure",
  "Le Signe des Anciens",
];

@Singleton
@OnlyInstantiableByContainer
/**
 * Service gérant le message de présence du bot.
 */
export class PresenceService extends BaseService {
  @Inject private envService!: EnvService;
  @Inject private randomService!: RandomService;

  /** Timer permettant de gérer la routine d'envoi de carte */
  private timer: NodeJS.Timer | undefined = undefined;

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);

    if (this.envService.ignorePresence) {
      return;
    }
    this.setRandomPresence();
    this.timer = setInterval(() => {
      this.setRandomPresence();
    }, 1000 * 60 * 60);
  }

  public shutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    return Promise.resolve();
  }

  /**
   * Positionne un message de présence aléatoire.
   */
  public setRandomPresence(): void {
    const activity =
      GAMES[this.randomService.getRandomInt(0, GAMES.length - 1)];
    this.setPresence(activity);
  }

  /**
   * Position le message de présence indiqué.
   *
   * @param presence Le message de présence
   */
  public setPresence(presence: string): void {
    if (!this.client || !this.client.user) {
      return;
    }
    this.client.user.setPresence({ activities: [{ name: presence }] });
  }
}

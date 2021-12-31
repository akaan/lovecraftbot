import * as Discord from "discord.js";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { EnvService } from "./EnvService";
import { RandomService } from "./RandomService";

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
export class PresenceService extends BaseService {
  @Inject private envService!: EnvService;
  @Inject private randomService!: RandomService;

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);

    if (this.envService.ignorePresence) {
      return;
    }
    this.setRandomPresence();
    setInterval(() => {
      this.setRandomPresence();
    }, 1000 * 60 * 60);
  }

  public setRandomPresence(): void {
    const activity =
      GAMES[this.randomService.getRandomInt(0, GAMES.length - 1)];
    this.setPresence(activity);
  }

  public setPresence(presence: string): void {
    if (!this.client || !this.client.user) {
      return;
    }
    this.client.user.setPresence({ activities: [{ name: presence }] });
  }
}

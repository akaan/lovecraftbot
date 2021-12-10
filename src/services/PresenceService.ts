import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";
import * as Discord from "discord.js";

import { BaseService } from "../base/BaseService";
import { EnvService } from "./EnvService";

@Singleton
@OnlyInstantiableByContainer
export class PresenceService extends BaseService {
  @Inject private envService!: EnvService;

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);

    if (this.envService.ignorePresence) {
      return;
    }
    this.setPresence("faire des bonhommes de neige");
  }

  public setPresence(presence: string): void {
    if (!this.client || !this.client.user) {
      return;
    }
    this.client.user.setPresence({ activities: [{ name: presence }] });
  }
}

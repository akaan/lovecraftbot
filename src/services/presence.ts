import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";
import * as Discord from "discord.js";

import { BaseService } from "../base/BaseService";
import { EnvService } from "./env";

@Singleton
@OnlyInstantiableByContainer
export class PresenceService extends BaseService {
  public name = "PresenceService";

  @Inject private envService?: EnvService;

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);

    if (!this.envService) {
      return;
    }

    if (this.envService.ignorePresence) {
      return;
    }
    await this.setPresence("faire des bonhommes de neige");
  }

  public async setPresence(presence: string): Promise<void> {
    if (!this.client || !this.client.user) {
      return;
    }
    await this.client.user.setPresence({ activity: { name: presence } });
  }
}

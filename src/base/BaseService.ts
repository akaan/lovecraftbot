import * as Discord from "discord.js";

import { IService } from "../interfaces";

export class BaseService implements IService {
  protected client?: Discord.Client;

  init(client: Discord.Client): Promise<void> {
    this.client = client;
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

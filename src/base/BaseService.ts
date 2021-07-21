import * as Discord from "discord.js";

import { IService } from "../interfaces";

export class BaseService implements IService {
  protected client?: Discord.Client;
  public name = "BaseService";

  init(client: Discord.Client): Promise<void> {
    this.client = client;
    return Promise.resolve();
  }
}

import * as Discord from "discord.js";

export interface IService {
  name: string;
  init(client: Discord.Client): Promise<void>;
}

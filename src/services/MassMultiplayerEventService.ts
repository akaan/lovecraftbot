import { Guild } from "discord.js";
import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";
import { BaseService } from "../base/BaseService";

@Singleton
@OnlyInstantiableByContainer
export class MassMultiplayerEventService extends BaseService {
  private groupChannelsIdByGuildId: { [guildId: string]: string[] } = {};

  public async createGroupChannels(
    guild: Guild,
    categoryName: string,
    numberOfGroups: number
  ): Promise<boolean> {
    const categoryId = this.getCategoryIdByName(guild, categoryName);
    if (!categoryId) return false;

    for (let groupNumber = 1; groupNumber <= numberOfGroups; groupNumber++) {
      const groupChannel = await guild.channels.create(
        `groupe-${groupNumber}`,
        {
          type: "text",
        }
      );
      await groupChannel.setParent(categoryId);
      if (this.groupChannelsIdByGuildId[guild.id]) {
        this.groupChannelsIdByGuildId[guild.id].push(groupChannel.id);
      } else {
        this.groupChannelsIdByGuildId[guild.id] = [groupChannel.id];
      }
    }
    return true;
  }

  private getCategoryIdByName(
    guild: Guild,
    categoryName: string
  ): string | undefined {
    return guild.channels.cache.find(
      (guildChannel) =>
        guildChannel.type === "category" && guildChannel.name === categoryName
    )?.id;
  }
}

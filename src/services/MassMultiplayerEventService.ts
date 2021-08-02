import { Client, Guild, MessageEmbed, TextChannel } from "discord.js";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";
import { BaseService } from "../base/BaseService";
import { LoggerService } from "./LoggerService";
import { ResourcesService } from "./ResourcesService";

@Singleton
@OnlyInstantiableByContainer
export class MassMultiplayerEventService extends BaseService {
  @Inject logger!: LoggerService;
  @Inject resourcesService!: ResourcesService;

  private groupChannelsIdByGuildId: { [guildId: string]: string[] } = {};

  public async init(client: Client): Promise<void> {
    await super.init(client);

    await Promise.all(
      client.guilds.cache.map((guild) => {
        return this.loadState(guild);
      })
    );
  }

  public async createGroupChannels(
    guild: Guild,
    categoryName: string,
    numberOfGroups: number
  ): Promise<void> {
    const categoryId = this.getCategoryIdByName(guild, categoryName);
    if (!categoryId)
      throw new Error("Impossible de créer les groupes sans catégorie");

    for (let groupNumber = 1; groupNumber <= numberOfGroups; groupNumber++) {
      const groupChannel = await guild.channels.create(
        `groupe-${groupNumber}`,
        {
          type: "text",
        }
      );
      await groupChannel.setParent(categoryId);

      const groupVoiceChannel = await guild.channels.create(
        `voice groupe-${groupNumber}`,
        {
          type: "voice",
        }
      );
      await groupVoiceChannel.setParent(categoryId);

      if (this.groupChannelsIdByGuildId[guild.id]) {
        this.groupChannelsIdByGuildId[guild.id].push(groupChannel.id);
        this.groupChannelsIdByGuildId[guild.id].push(groupVoiceChannel.id);
      } else {
        this.groupChannelsIdByGuildId[guild.id] = [
          groupChannel.id,
          groupVoiceChannel.id,
        ];
      }
    }
    await this.saveState(guild);
  }

  public async cleanGroupChannels(guild: Guild): Promise<void> {
    const groupsId = this.groupChannelsIdByGuildId[guild.id];
    await Promise.all(
      groupsId.map((groupId) => {
        const channel = guild.channels.cache.find(
          (channel) => channel.id === groupId
        );
        return channel ? channel.delete() : Promise.resolve(null);
      })
    );
    this.groupChannelsIdByGuildId[guild.id] = [];
    await this.saveState(guild);
  }

  public async broadcastMessage(
    guild: Guild,
    content: string | MessageEmbed,
    excludeGroupIds?: string[]
  ): Promise<void> {
    let groupsId = this.groupChannelsIdByGuildId[guild.id];
    if (excludeGroupIds) {
      groupsId = groupsId.filter((id) => !excludeGroupIds.includes(id));
    }
    await Promise.all(
      groupsId.map((groupId) => {
        const channel = guild.channels.cache.find(
          (channel) => channel.id === groupId
        );
        if (channel && channel.type === "text") {
          return (channel as TextChannel).send(content);
        }
        return Promise.resolve(null);
      })
    );
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

  private async saveState(guild: Guild): Promise<void> {
    try {
      await this.resourcesService.saveGuildResource(
        guild,
        `massMultiplayerEventsGroups.json`,
        JSON.stringify(this.groupChannelsIdByGuildId[guild.id])
      );
    } catch (err) {
      this.logger.error(err);
    }
  }

  private async loadState(guild: Guild): Promise<void> {
    try {
      if (
        await this.resourcesService.guildResourceExists(
          guild,
          `massMultiplayerEventsGroups.json`
        )
      ) {
        const raw = await this.resourcesService.readGuildResource(
          guild,
          `massMultiplayerEventsGroups.json`
        );
        if (raw) {
          const groupsId = JSON.parse(raw) as string[];
          this.groupChannelsIdByGuildId[guild.id] = groupsId;
        }
      }
    } catch (err) {
      this.logger.error(err);
    }
  }
}

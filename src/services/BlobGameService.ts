import {
  Client,
  EmbedFieldData,
  Guild,
  MessageEmbed,
  TextChannel,
} from "discord.js";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";
import { BaseService } from "../base/BaseService";
import { BlobGame } from "../domain/BlobGame";
import { BlobGameFileRepository } from "./BlobGameFileRepository";
import { LoggerService } from "./LoggerService";
import { RandomService } from "./RandomService";
import { ResourcesService } from "./ResourcesService";

interface BlobGameStats {
  damageDealt: number;
  numberOfCluesAdded: number;
  numberOfCounterMeasuresSpent: number;
  numberOfCounterMeasuresAdded: number;
}

type BlobGameStatsByGroup = { [groupId: string]: BlobGameStats };

const sortByDateDesc = (bg1: BlobGame, bg2: BlobGame) => {
  if (bg1.getDateCreated() < bg2.getDateCreated()) return 1;
  if (bg1.getDateCreated() > bg2.getDateCreated()) return -1;
  return 0;
};

@Singleton
@OnlyInstantiableByContainer
export class BlobGameService extends BaseService {
  private blobGameRepositoryByGuildId: {
    [guildId: string]: BlobGameFileRepository;
  } = {};
  private currentGameByGuildId: { [guildId: string]: BlobGame } = {};
  private gameStatsByGuildId: { [guildId: string]: BlobGameStatsByGroup } = {};

  @Inject private logger!: LoggerService;
  @Inject private randomService!: RandomService;
  @Inject private resourcesService!: ResourcesService;

  public async init(client: Client): Promise<void> {
    await super.init(client);

    await Promise.all(
      client.guilds.cache.map((guild) => {
        return this.continueLatestGame(guild);
      })
    );

    await Promise.all(
      client.guilds.cache.map((guild) => {
        return this.loadState(guild);
      })
    );
  }

  public async startNewGame(
    guild: Guild,
    numberOfPlayers: number
  ): Promise<void> {
    const repository = this.getBlobGameRepository(guild);

    const nextId = await repository.nextId();
    const game = (this.currentGameByGuildId[guild.id] = new BlobGame(
      nextId,
      new Date(),
      numberOfPlayers
    ));
    game.initNumberOfCounterMeasure();
    const randomStory =
      BlobGame.POSSIBLE_STORIES[
        this.randomService.getRandomInt(0, BlobGame.POSSIBLE_STORIES.length - 1)
      ];
    game.chooseStory(randomStory);
    await repository.save(game);
    return;
  }

  public isGameRunning(guild: Guild): boolean {
    return !!this.currentGameByGuildId[guild.id];
  }

  public createGameStateEmbed(guild: Guild): MessageEmbed | undefined {
    if (!this.isGameRunning(guild)) return undefined;
    const game = this.currentGameByGuildId[guild.id];

    const embed = new MessageEmbed();

    embed.setTitle(
      `Le Dévoreur de Toute Chose - ${game
        .getDateCreated()
        .toLocaleDateString()}`
    );
    embed.setColor(0x67c355);
    embed.addFields([
      { name: "Nombre de joueurs", value: game.getNumberOfPlayers() },
      {
        name: "Points de vie restants / total",
        value: `${game.getBlobRemainingHealth()} / ${game.getBlobTotalHealth()}`,
      },
      {
        name: "Indices sur l'Acte 1",
        value: `${game.getNumberOfCluesOnAct1()} / ${game.getAct1ClueThreshold()}`,
      },
      {
        name: "Nombre de contre-mesures",
        value: game.getNumberOfCounterMeasures(),
      },
    ]);

    return embed;
  }

  public createGameStatsEmbed(guild: Guild): MessageEmbed | undefined {
    if (!this.isGameRunning(guild)) return undefined;
    const game = this.currentGameByGuildId[guild.id];

    if (!this.gameStatsByGuildId[guild.id]) return undefined;
    const gameStats = this.gameStatsByGuildId[guild.id];

    const embed = new MessageEmbed();

    embed.setTitle(
      `Le Dévoreur de Toute Chose - ${game
        .getDateCreated()
        .toLocaleDateString()} - Statistiques`
    );
    embed.setColor(0x67c355);

    const fields: EmbedFieldData[] = Object.keys(gameStats).reduce(
      (memo, groupId) => {
        const group = this.client?.channels.cache.find(
          (channel) => channel.id === groupId
        );
        if (group) {
          const statsForGroup = gameStats[groupId];
          const fieldValue = [
            `Nombre de dégât(s): ${statsForGroup.damageDealt}`,
            `Nombre d'indice(s): ${statsForGroup.numberOfCluesAdded}`,
            `Nombre de contre-mesures ajoutée(s): ${statsForGroup.numberOfCounterMeasuresAdded}`,
            `Nombre de contre-mesures dépensée(s): ${statsForGroup.numberOfCounterMeasuresSpent}`,
          ].join("\n");
          memo.push({ name: (group as TextChannel).name, value: fieldValue });
        }
        return memo;
      },
      [] as EmbedFieldData[]
    );
    embed.addFields(fields);

    return embed;
  }

  public async endGame(guild: Guild): Promise<void> {
    const repository = this.getBlobGameRepository(guild);
    this.currentGameByGuildId[guild.id].endGame(new Date());
    await repository.save(this.currentGameByGuildId[guild.id]);
    delete this.currentGameByGuildId[guild.id];
    this.gameStatsByGuildId[guild.id] = {};
    await this.saveState(guild);
  }

  public getBlobTotalHealth(guild: Guild): number | undefined {
    if (!this.currentGameByGuildId[guild.id]) return;
    return this.currentGameByGuildId[guild.id].getBlobTotalHealth();
  }

  public getBlobRemainingHealth(guild: Guild): number | undefined {
    if (!this.currentGameByGuildId[guild.id]) return;
    return this.currentGameByGuildId[guild.id].getBlobRemainingHealth();
  }

  public getNumberOfDamageDealtToBlob(guild: Guild): number | undefined {
    if (!this.currentGameByGuildId[guild.id]) return;
    return this.currentGameByGuildId[guild.id].getNumberOfDamageDealtToBlob();
  }

  public dealDamageToBlob(
    guild: Guild,
    numberOfDamageDealt: number,
    groupId: string
  ): Promise<void> {
    if (!this.currentGameByGuildId[guild.id])
      return Promise.reject(new Error("Pas de partie en cours"));
    this.currentGameByGuildId[guild.id].dealDamageToBlob(numberOfDamageDealt);
    this.recordStat(guild, groupId, "damageDealt", numberOfDamageDealt);
    return this.getBlobGameRepository(guild).save(
      this.currentGameByGuildId[guild.id]
    );
  }

  public getAct1ClueThreshold(guild: Guild): number | undefined {
    if (!this.currentGameByGuildId[guild.id]) return;
    return this.currentGameByGuildId[guild.id].getAct1ClueThreshold();
  }

  public getNumberOfCluesOnAct1(guild: Guild): number | undefined {
    if (!this.currentGameByGuildId[guild.id]) return;
    return this.currentGameByGuildId[guild.id].getNumberOfCluesOnAct1();
  }

  public placeCluesOnAct1(
    guild: Guild,
    numberOfClues: number,
    groupId: string
  ): Promise<void> {
    if (!this.currentGameByGuildId[guild.id])
      return Promise.reject(new Error("Pas de partie en cours"));
    if (numberOfClues > 3)
      return Promise.reject(
        new Error("L'Acte 1 précise qu'on peut dépenser au plus 3 indices")
      );
    this.currentGameByGuildId[guild.id].placeCluesOnAct1(numberOfClues);
    this.recordStat(guild, groupId, "numberOfCluesAdded", numberOfClues);
    return this.getBlobGameRepository(guild).save(
      this.currentGameByGuildId[guild.id]
    );
  }

  public getNumberOfCounterMeasures(guild: Guild): number | undefined {
    if (!this.currentGameByGuildId[guild.id]) return;
    return this.currentGameByGuildId[guild.id].getNumberOfCounterMeasures();
  }

  public gainCounterMeasures(
    guild: Guild,
    numberOfCounterMeasures: number,
    groupId: string
  ): Promise<void> {
    if (!this.currentGameByGuildId[guild.id])
      return Promise.reject(new Error("Pas de partie en cours"));
    this.currentGameByGuildId[guild.id].gainCounterMeasures(
      numberOfCounterMeasures
    );
    this.recordStat(
      guild,
      groupId,
      "numberOfCounterMeasuresAdded",
      numberOfCounterMeasures
    );
    return this.getBlobGameRepository(guild).save(
      this.currentGameByGuildId[guild.id]
    );
  }

  public spendCounterMeasures(
    guild: Guild,
    numberOfCounterMeasures: number,
    groupId: string
  ): Promise<void> {
    if (!this.currentGameByGuildId[guild.id])
      return Promise.reject(new Error("Pas de partie en cours"));
    this.currentGameByGuildId[guild.id].spendCounterMeasures(
      numberOfCounterMeasures
    );
    this.recordStat(
      guild,
      groupId,
      "numberOfCounterMeasuresSpent",
      numberOfCounterMeasures
    );
    return this.getBlobGameRepository(guild).save(
      this.currentGameByGuildId[guild.id]
    );
  }

  public getStory(guild: Guild): string | undefined {
    if (!this.currentGameByGuildId[guild.id]) return;
    return this.currentGameByGuildId[guild.id].getStory();
  }

  private getBlobGameRepository(guild: Guild): BlobGameFileRepository {
    if (!this.blobGameRepositoryByGuildId[guild.id]) {
      this.blobGameRepositoryByGuildId[guild.id] = new BlobGameFileRepository(
        guild
      );
    }
    return this.blobGameRepositoryByGuildId[guild.id];
  }

  private async continueLatestGame(guild: Guild): Promise<Date | undefined> {
    const repository = this.getBlobGameRepository(guild);

    const availableBlobGames = await repository.load();
    if (availableBlobGames.length === 0) return undefined;

    const runningGames = availableBlobGames.filter(
      (game) => typeof game.getDateEnded() === "undefined"
    );

    if (runningGames.length === 0) return undefined;

    this.currentGameByGuildId[guild.id] = runningGames.sort(sortByDateDesc)[0];
    return this.currentGameByGuildId[guild.id].getDateCreated();
  }

  private recordStat(
    guild: Guild,
    groupId: string,
    statName: keyof BlobGameStats,
    amount: number
  ): void {
    if (!this.gameStatsByGuildId[guild.id]) {
      this.gameStatsByGuildId[guild.id] = {};
    }
    if (!this.gameStatsByGuildId[guild.id][groupId]) {
      this.gameStatsByGuildId[guild.id][groupId] = {
        damageDealt: 0,
        numberOfCluesAdded: 0,
        numberOfCounterMeasuresAdded: 0,
        numberOfCounterMeasuresSpent: 0,
      };
    }

    this.gameStatsByGuildId[guild.id][groupId][statName] =
      this.gameStatsByGuildId[guild.id][groupId][statName] + amount;

    this.saveState(guild).catch((err) => this.logger.error(err));
  }

  private async loadState(guild: Guild): Promise<void> {
    try {
      if (
        await this.resourcesService.guildResourceExists(
          guild,
          `blobGameStats.json`
        )
      ) {
        const raw = await this.resourcesService.readGuildResource(
          guild,
          `blobGameStats.json`
        );
        if (raw) {
          const parsed = JSON.parse(raw) as BlobGameStatsByGroup;
          this.gameStatsByGuildId[guild.id] = parsed;
        } else {
          this.gameStatsByGuildId[guild.id] = {};
        }
      }
    } catch (err) {
      this.logger.error(err);
    }
  }

  private async saveState(guild: Guild): Promise<void> {
    if (!this.gameStatsByGuildId[guild.id]) return;
    try {
      await this.resourcesService.saveGuildResource(
        guild,
        `blobGameStats.json`,
        JSON.stringify(this.gameStatsByGuildId[guild.id], null, "  ")
      );
    } catch (err) {
      this.logger.error(err);
    }
  }
}

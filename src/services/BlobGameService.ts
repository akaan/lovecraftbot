import { Guild } from "discord.js";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";
import { BaseService } from "../base/BaseService";
import { BlobGame } from "../domain/BlobGame";
import {
  BlobGameFileRepository,
  BlobGameFileRepositoryFactory,
} from "./BlobGameFileRepository";
import { RandomService } from "./RandomService";

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

  constructor(
    @Inject private blobGameRepositoryFactory: BlobGameFileRepositoryFactory,
    @Inject private randomService: RandomService
  ) {
    super();
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
    const randomStory =
      BlobGame.POSSIBLE_STORIES[
        this.randomService.getRandomInt(0, BlobGame.POSSIBLE_STORIES.length - 1)
      ];
    game.chooseStory(randomStory);
    await repository.save(game);
    return;
  }

  public async continueLatestGame(guild: Guild): Promise<boolean> {
    const repository = this.getBlobGameRepository(guild);
    const availableBlobGames = await repository.load();
    if (availableBlobGames.length === 0) return false;
    this.currentGameByGuildId[guild.id] =
      availableBlobGames.sort(sortByDateDesc)[0];
    return true;
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
    numberOfDamageDealt: number
  ): Promise<void> {
    if (!this.currentGameByGuildId[guild.id]) return Promise.reject();
    this.currentGameByGuildId[guild.id].dealDamageToBlob(numberOfDamageDealt);
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

  public placeCluesOnAct1(guild: Guild, numberOfClues: number): Promise<void> {
    if (!this.currentGameByGuildId[guild.id]) return Promise.reject();
    this.currentGameByGuildId[guild.id].placeCluesOnAct1(numberOfClues);
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
    numberOfCounterMeasures: number
  ): Promise<void> {
    if (!this.currentGameByGuildId[guild.id]) return Promise.reject();
    this.currentGameByGuildId[guild.id].gainCounterMeasures(
      numberOfCounterMeasures
    );
    return this.getBlobGameRepository(guild).save(
      this.currentGameByGuildId[guild.id]
    );
  }

  public spendCounterMeasures(
    guild: Guild,
    numberOfCounterMeasures: number
  ): Promise<void> {
    if (!this.currentGameByGuildId[guild.id]) return Promise.reject();
    this.currentGameByGuildId[guild.id].spendCounterMeasures(
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
      this.blobGameRepositoryByGuildId[guild.id] =
        this.blobGameRepositoryFactory.create(guild);
    }
    return this.blobGameRepositoryByGuildId[guild.id];
  }
}

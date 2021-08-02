import { Client, Guild, MessageEmbed } from "discord.js";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";
import { BaseService } from "../base/BaseService";
import { BlobGame } from "../domain/BlobGame";
import { BlobGameFileRepository } from "./BlobGameFileRepository";
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

  @Inject private randomService!: RandomService;

  public async init(client: Client): Promise<void> {
    await super.init(client);

    await Promise.all(
      client.guilds.cache.map((guild) => {
        return this.continueLatestGame(guild);
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

  public async endGame(guild: Guild): Promise<void> {
    const repository = this.getBlobGameRepository(guild);
    this.currentGameByGuildId[guild.id].endGame(new Date());
    await repository.save(this.currentGameByGuildId[guild.id]);
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
}

import {
  Channel,
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
import { MassMultiplayerEventService } from "./MassMultiplayerEventService";
import { RandomService } from "./RandomService";
import { ResourcesService } from "./ResourcesService";

interface BlobGameStats {
  damageDealt: number;
  numberOfCluesAdded: number;
  numberOfCounterMeasuresSpent: number;
  numberOfCounterMeasuresAdded: number;
}

type BlobGameStatsByGroup = { [groupId: string]: BlobGameStats };

interface BlobGameServiceState {
  stats?: BlobGameStatsByGroup;
  timer?: number;
}

const sortByDateDesc = (bg1: BlobGame, bg2: BlobGame) => {
  if (bg1.getDateCreated() < bg2.getDateCreated()) return 1;
  if (bg1.getDateCreated() > bg2.getDateCreated()) return -1;
  return 0;
};

@Singleton
@OnlyInstantiableByContainer
export class BlobGameService extends BaseService {
  private static STATE_FILE_NAME = "blobGameServiceState.json";

  private blobGameRepositoryByGuildId: {
    [guildId: string]: BlobGameFileRepository;
  } = {};
  private currentGameByGuildId: { [guildId: string]: BlobGame } = {};
  private gameStatsByGuildId: { [guildId: string]: BlobGameStatsByGroup } = {};
  private gameTimerByGuildId: { [guildId: string]: number } = {};
  private gameTimeoutByGuildId: { [guildId: string]: NodeJS.Timeout } = {};

  @Inject private logger!: LoggerService;
  @Inject private randomService!: RandomService;
  @Inject private resourcesService!: ResourcesService;
  @Inject private massMultiplayerEventService!: MassMultiplayerEventService;

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

  public ready(): boolean {
    return this.massMultiplayerEventService.ready();
  }

  public isEventChannel(channel: Channel): boolean {
    return this.massMultiplayerEventService.isEventChannel(channel);
  }

  public isAdminChannel(channel: Channel): boolean {
    return this.massMultiplayerEventService.isAdminChannel(channel);
  }

  public async startNewGame(
    guild: Guild,
    numberOfPlayers: number,
    numberOfGroups: number
  ): Promise<void> {
    if (!this.ready())
      return Promise.reject(new Error("Problème de configuration"));
    if (this.massMultiplayerEventService.runningEvent(guild))
      return Promise.reject(new Error("Il y a déjà un événement en cours"));

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

    await this.massMultiplayerEventService.createGroupChannels(
      guild,
      numberOfGroups
    );

    return;
  }

  private setUpTimerInterval(guild: Guild): void {
    if (!this.client)
      throw new Error(
        "Pas de client Discord, impossible de créer une minuterie"
      );

    this.gameTimeoutByGuildId[guild.id] = this.client.setInterval(() => {
      if (guild.id in this.gameTimerByGuildId) {
        this.gameTimerByGuildId[guild.id] -= 1;
        this.saveState(guild).catch((err) => this.logger.error(err));
        if (this.gameTimerByGuildId[guild.id] === 0) {
          this.timeIsUp(guild);
          this.clearTimerInterval(guild);
          return;
        }
        if (this.gameTimerByGuildId[guild.id] % 15 === 0) {
          this.tellTimeRemaining(guild);
        }
      }
    }, 1000 * 60);
  }

  private clearTimerInterval(guild: Guild) {
    if (!this.client)
      throw new Error(
        "Pas de client Discord, impossible de stopper une minuterie"
      );

    if (guild.id in this.gameTimeoutByGuildId) {
      this.client.clearInterval(this.gameTimeoutByGuildId[guild.id]);
      delete this.gameTimeoutByGuildId[guild.id];
    }
  }

  private timeIsUp(guild: Guild): void {
    this.massMultiplayerEventService
      .broadcastMessage(guild, "La partie est terminée !")
      .catch((err) => this.logger.error(err));
  }

  private tellTimeRemaining(guild: Guild): void {
    if (guild.id in this.gameTimerByGuildId) {
      this.massMultiplayerEventService
        .broadcastMessage(
          guild,
          `Le temps passe ... il reste ${
            this.gameTimerByGuildId[guild.id]
          } minutes pour vaincre le Dévoreur`
        )
        .catch((err) => this.logger.error(err));
    }
  }

  public startTimer(guild: Guild, minutes: number): void {
    if (guild.id in this.gameTimeoutByGuildId)
      throw new Error("Il y a déjà une minuterie en cours");

    this.gameTimerByGuildId[guild.id] = minutes;
    this.setUpTimerInterval(guild);
    this.saveState(guild).catch((err) => this.logger.error(err));
  }

  public pauseTimer(guild: Guild): void {
    this.clearTimerInterval(guild);
  }

  public resumeTimer(guild: Guild): void {
    this.setUpTimerInterval(guild);
  }

  public isGameRunning(guild: Guild): boolean {
    return !!this.currentGameByGuildId[guild.id];
  }

  public createGameStateEmbed(guild: Guild): MessageEmbed | undefined {
    if (!this.isGameRunning(guild)) return undefined;
    const game = this.currentGameByGuildId[guild.id];
    let minuterie = "Minuterie non initialisée";
    if (guild.id in this.gameTimerByGuildId) {
      minuterie = `${this.gameTimerByGuildId[guild.id]} minutes`;
      if (!(guild.id in this.gameTimeoutByGuildId)) {
        minuterie += " (en pause)";
      }
    }

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
      {
        name: "Temps restant",
        value: minuterie,
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
    await this.massMultiplayerEventService.cleanGroupChannels(guild);
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

  public async dealDamageToBlob(
    guild: Guild,
    numberOfDamageDealt: number,
    groupChannel: TextChannel
  ): Promise<void> {
    if (!this.currentGameByGuildId[guild.id])
      return Promise.reject(new Error("Pas de partie en cours"));
    this.currentGameByGuildId[guild.id].dealDamageToBlob(numberOfDamageDealt);
    this.recordStat(guild, groupChannel.id, "damageDealt", numberOfDamageDealt);
    await this.getBlobGameRepository(guild).save(
      this.currentGameByGuildId[guild.id]
    );

    if (this.getBlobRemainingHealth(guild) === 0) {
      await groupChannel.send(
        `vous portez le coup fatal avec ${numberOfDamageDealt} infligé(s) ! Bravo !`
      );
      await this.massMultiplayerEventService.broadcastMessage(
        guild,
        `${groupChannel.name} a porté le coup fatal en infligeant ${numberOfDamageDealt} dégât(s) au Dévoreur !`,
        [groupChannel.id]
      );
      await this.gameWon(guild);
    } else {
      await this.massMultiplayerEventService.broadcastMessage(
        guild,
        `${groupChannel.name} a infligé ${numberOfDamageDealt} dégât(s) au Dévoreur !`,
        [groupChannel.id]
      );
    }
  }

  public getAct1ClueThreshold(guild: Guild): number | undefined {
    if (!this.currentGameByGuildId[guild.id]) return;
    return this.currentGameByGuildId[guild.id].getAct1ClueThreshold();
  }

  public getNumberOfCluesOnAct1(guild: Guild): number | undefined {
    if (!this.currentGameByGuildId[guild.id]) return;
    return this.currentGameByGuildId[guild.id].getNumberOfCluesOnAct1();
  }

  public async placeCluesOnAct1(
    guild: Guild,
    numberOfClues: number,
    groupChannel: TextChannel
  ): Promise<void> {
    if (!this.currentGameByGuildId[guild.id])
      return Promise.reject(new Error("Pas de partie en cours"));
    if (numberOfClues > 3)
      return Promise.reject(
        new Error("L'Acte 1 précise qu'on peut dépenser au plus 3 indices")
      );
    this.currentGameByGuildId[guild.id].placeCluesOnAct1(numberOfClues);
    this.recordStat(
      guild,
      groupChannel.id,
      "numberOfCluesAdded",
      numberOfClues
    );
    await this.getBlobGameRepository(guild).save(
      this.currentGameByGuildId[guild.id]
    );

    await this.massMultiplayerEventService.broadcastMessage(
      guild,
      `${groupChannel.name} a placé ${numberOfClues} indice(s) sur l'Acte 1 !`,
      [groupChannel.id]
    );

    if (
      this.currentGameByGuildId[guild.id].getNumberOfCluesOnAct1() ===
      this.currentGameByGuildId[guild.id].getAct1ClueThreshold()
    ) {
      await this.massMultiplayerEventService.broadcastMessage(
        guild,
        `Les investigateurs ont réunis l'ensemble des indices nécessaires. Dès le prochain round, vous pouvez faire avancer l'Acte 1.`
      );
    }
  }

  public getNumberOfCounterMeasures(guild: Guild): number | undefined {
    if (!this.currentGameByGuildId[guild.id]) return;
    return this.currentGameByGuildId[guild.id].getNumberOfCounterMeasures();
  }

  public async gainCounterMeasures(
    guild: Guild,
    numberOfCounterMeasures: number,
    groupChannel: TextChannel
  ): Promise<void> {
    if (!this.currentGameByGuildId[guild.id])
      return Promise.reject(new Error("Pas de partie en cours"));
    this.currentGameByGuildId[guild.id].gainCounterMeasures(
      numberOfCounterMeasures
    );
    this.recordStat(
      guild,
      groupChannel.id,
      "numberOfCounterMeasuresAdded",
      numberOfCounterMeasures
    );
    await this.getBlobGameRepository(guild).save(
      this.currentGameByGuildId[guild.id]
    );
    await this.massMultiplayerEventService.broadcastMessage(
      guild,
      `${groupChannel.name} a ajouté ${numberOfCounterMeasures} contre-mesures(s) !`,
      [groupChannel.id]
    );
  }

  public async spendCounterMeasures(
    guild: Guild,
    numberOfCounterMeasures: number,
    groupChannel: TextChannel
  ): Promise<void> {
    if (!this.currentGameByGuildId[guild.id])
      return Promise.reject(new Error("Pas de partie en cours"));
    this.currentGameByGuildId[guild.id].spendCounterMeasures(
      numberOfCounterMeasures
    );
    this.recordStat(
      guild,
      groupChannel.id,
      "numberOfCounterMeasuresSpent",
      numberOfCounterMeasures
    );
    await this.getBlobGameRepository(guild).save(
      this.currentGameByGuildId[guild.id]
    );
    await this.massMultiplayerEventService.broadcastMessage(
      guild,
      `${groupChannel.name} a dépensé ${numberOfCounterMeasures} contre-mesures(s) !`,
      [groupChannel.id]
    );
  }

  public getStory(guild: Guild): string | undefined {
    const game = this.currentGameByGuildId[guild.id];
    if (!game) return;
    if (!(game.getNumberOfCluesOnAct1() === game.getAct1ClueThreshold()))
      return;
    return game.getStory();
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

  private async gameWon(guild: Guild): Promise<void> {
    await this.massMultiplayerEventService.broadcastMessage(
      guild,
      `Félications, vous avez vaincu le Dévoreur !`
    );
    const statsEmbed = this.createGameStatsEmbed(guild);
    if (statsEmbed) {
      await this.massMultiplayerEventService.broadcastMessage(
        guild,
        statsEmbed
      );
    }
  }

  private async loadState(guild: Guild): Promise<void> {
    try {
      if (
        await this.resourcesService.guildResourceExists(
          guild,
          BlobGameService.STATE_FILE_NAME
        )
      ) {
        const raw = await this.resourcesService.readGuildResource(
          guild,
          BlobGameService.STATE_FILE_NAME
        );
        if (raw) {
          const parsed = JSON.parse(raw) as BlobGameServiceState;
          if (parsed.stats) this.gameStatsByGuildId[guild.id] = parsed.stats;
          if (parsed.timer) this.gameTimerByGuildId[guild.id] = parsed.timer;
        } else {
          this.gameStatsByGuildId[guild.id] = {};
        }
      }
    } catch (err) {
      this.logger.error(err);
    }
  }

  private async saveState(guild: Guild): Promise<void> {
    try {
      const state: BlobGameServiceState = {};
      if (this.gameStatsByGuildId[guild.id])
        state.stats = this.gameStatsByGuildId[guild.id];
      if (this.gameTimerByGuildId[guild.id])
        state.timer = this.gameTimerByGuildId[guild.id];

      await this.resourcesService.saveGuildResource(
        guild,
        BlobGameService.STATE_FILE_NAME,
        JSON.stringify(state, null, "  ")
      );
    } catch (err) {
      this.logger.error(err);
    }
  }
}

import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";
import { BaseService } from "../base/BaseService";
import { BlobGame } from "../domain/BlobGame";
import { BlobGameFileRepository } from "./BlobGameFileRepository";
import { RandomService } from "./random";

const sortByDateDesc = (bg1: BlobGame, bg2: BlobGame) => {
  if (bg1.getDateCreated() < bg2.getDateCreated()) return 1;
  if (bg1.getDateCreated() > bg2.getDateCreated()) return -1;
  return 0;
};

@Singleton
@OnlyInstantiableByContainer
export class BlobGameService extends BaseService {
  @Inject private blobGameRepository?: BlobGameFileRepository;
  @Inject private randomService?: RandomService;

  private currentGame?: BlobGame;

  public async startNewGame(numberOfPlayers: number): Promise<void> {
    if (!this.blobGameRepository || !this.randomService) {
      return;
    }
    const nextId = await this.blobGameRepository.nextId();
    this.currentGame = new BlobGame(nextId, new Date(), numberOfPlayers);
    const randomStory =
      BlobGame.POSSIBLE_STORIES[
        this.randomService.getRandomInt(0, BlobGame.POSSIBLE_STORIES.length)
      ];
    this.currentGame.chooseStory(randomStory);
    await this.blobGameRepository.save(this.currentGame);
    return;
  }

  public async continueLatestGame(): Promise<boolean> {
    if (!this.blobGameRepository) return false;
    const availableBlobGames = await this.blobGameRepository.load();
    if (availableBlobGames.length === 0) return false;
    this.currentGame = availableBlobGames.sort(sortByDateDesc)[0];
    return true;
  }

  public getBlobTotalHealth(): number | undefined {
    if (!this.currentGame) return;
    return this.currentGame.getBlobTotalHealth();
  }

  public getBlobRemainingHealth(): number | undefined {
    if (!this.currentGame) return;
    return this.currentGame.getBlobRemainingHealth();
  }

  public getNumberOfDamageDealtToBlob(): number | undefined {
    if (!this.currentGame) return;
    return this.currentGame.getNumberOfDamageDealtToBlob();
  }

  public dealDamageToBlob(numberOfDamageDealt: number): Promise<void> {
    if (!this.currentGame || !this.blobGameRepository) return Promise.reject();
    this.currentGame.dealDamageToBlob(numberOfDamageDealt);
    return this.blobGameRepository.save(this.currentGame);
  }

  public getAct1ClueThreshold(): number | undefined {
    if (!this.currentGame) return;
    return this.currentGame.getAct1ClueThreshold();
  }

  public getNumberOfCluesOnAct1(): number | undefined {
    if (!this.currentGame) return;
    return this.currentGame.getNumberOfCluesOnAct1();
  }

  public placeCluesOnAct1(numberOfClues: number): Promise<void> {
    if (!this.currentGame || !this.blobGameRepository) return Promise.reject();
    this.currentGame.placeCluesOnAct1(numberOfClues);
    return this.blobGameRepository.save(this.currentGame);
  }

  public getNumberOfCounterMeasures(): number | undefined {
    if (!this.currentGame) return;
    return this.currentGame.getNumberOfCounterMeasures();
  }

  public gainCounterMeasures(numberOfCounterMeasures: number): Promise<void> {
    if (!this.currentGame || !this.blobGameRepository) return Promise.reject();
    this.currentGame.gainCounterMeasures(numberOfCounterMeasures);
    return this.blobGameRepository.save(this.currentGame);
  }

  public spendCounterMeasures(numberOfCounterMeasures: number): Promise<void> {
    if (!this.currentGame || !this.blobGameRepository) return Promise.reject();
    this.currentGame.spendCounterMeasures(numberOfCounterMeasures);
    return this.blobGameRepository.save(this.currentGame);
  }

  public getStory(): string | undefined {
    if (!this.currentGame) return;
    return this.currentGame.getStory();
  }
}

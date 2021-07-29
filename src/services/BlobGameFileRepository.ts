import { Inject } from "typescript-ioc";

import { BlobGame } from "../domain/BlobGame";
import { IBlobGameRepository } from "../domain/IBlobGameRepository";
import { LoggerService } from "./logger";
import { ResourcesService } from "./resources";

interface BlobGameSaved {
  id: number;
  dateCreated: string;
  numberOfPlayers: number;
  numberOfDamageDealtToBlob: number;
  numberOfCluesOnAct1: number;
  numberOfCounterMeasures: number;
  story?: string;
}

export class BlobGameFileRepository implements IBlobGameRepository {
  @Inject private resourcesService?: ResourcesService;
  @Inject private logger?: LoggerService;

  public async get(id: number): Promise<BlobGame | undefined> {
    return (await this.load()).find((game) => game.getId() === id);
  }

  public async nextId(): Promise<number> {
    const blobGames = await this.load();
    return (
      blobGames.reduce(
        (max, game) => (game.getId() > max ? game.getId() : max),
        0
      ) + 1
    );
  }

  public async save(blobGame: BlobGame): Promise<void> {
    if (!this.resourcesService) {
      return;
    }
    try {
      // TODO
      const blobGames = await this.load();
      const updatedBlobGames = blobGames.some(
        (loadedBlogGame) => loadedBlogGame.getId() === blobGame.getId()
      )
        ? blobGames.map((loadedBlobGame) =>
            loadedBlobGame.getId() === blobGame.getId()
              ? blobGame
              : loadedBlobGame
          )
        : [...blobGames, blobGame];
      await this.resourcesService.saveResource(
        "blobGames.json",
        JSON.stringify(
          updatedBlobGames.map((updatedBlobGame) => ({
            id: updatedBlobGame.getId(),
            dateCreated: updatedBlobGame.getDateCreated(),
            numberOfPlayers: updatedBlobGame.getNumberOfPlayers(),
            numberOfDamageDealtToBlob: updatedBlobGame.getNumberOfDamageDealtToBlob(),
            numberOfCluesOnAct1: updatedBlobGame.getNumberOfCluesOnAct1(),
            numberOfCounterMeasures: updatedBlobGame.getNumberOfCounterMeasures(),
            story: updatedBlobGame.getStory(),
          }))
        )
      );
    } catch (err) {
      this.logger && this.logger.error(err);
    }
  }

  public async load(): Promise<BlobGame[]> {
    if (!this.resourcesService) {
      return [];
    }

    try {
      if (!(await this.resourcesService.resourceExists("blobGames.json"))) {
        return [];
      }

      const raw = await this.resourcesService.readResource("blobGames.json");
      if (raw) {
        const parsed = JSON.parse(raw) as BlobGameSaved[];
        if (!this.isValid(parsed)) {
          this.logger && this.logger.error("Unable to parse blobGames.json");
          return [];
        }
        return parsed.map((blobGameSaved) => {
          const dateCreated = new Date(blobGameSaved.dateCreated);
          const blobGame = new BlobGame(
            blobGameSaved.id,
            dateCreated,
            blobGameSaved.numberOfPlayers
          );
          blobGame.dealDamageToBlob(blobGameSaved.numberOfDamageDealtToBlob);
          blobGame.placeCluesOnAct1(blobGameSaved.numberOfCluesOnAct1);
          blobGame.gainCounterMeasures(blobGameSaved.numberOfCounterMeasures);
          if (blobGameSaved.story) blobGame.chooseStory(blobGameSaved.story);
          return blobGame;
        });
      }
    } catch (err) {
      this.logger && this.logger.error(err);
    }

    return [];
  }

  private isValid(parsed: BlobGameSaved[]): boolean {
    if (!Array.isArray(parsed)) {
      return false;
    }
    return parsed.every(
      (blobGame) =>
        typeof blobGame.id === "number" &&
        typeof blobGame.dateCreated === "string" &&
        !isNaN(Date.parse(blobGame.dateCreated)) &&
        typeof blobGame.numberOfPlayers === "number" &&
        typeof blobGame.numberOfDamageDealtToBlob === "number" &&
        typeof blobGame.numberOfCluesOnAct1 === "number" &&
        typeof blobGame.numberOfCounterMeasures === "number" &&
        (typeof blobGame.story === "string" ||
          typeof blobGame.story === "undefined")
    );
  }
}

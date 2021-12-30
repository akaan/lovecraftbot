import { Guild } from "discord.js";
import { Inject } from "typescript-ioc";

import { BlobGame } from "../domain/BlobGame";
import { IBlobGameRepository } from "../domain/IBlobGameRepository";

import { LoggerService } from "./LoggerService";
import { ResourcesService } from "./ResourcesService";

interface BlobGameSaved {
  id: number;
  dateCreated: string;
  dateEnded?: string;
  numberOfPlayers: number;
  numberOfDamageDealtToBlob: number;
  numberOfCluesOnAct1: number;
  numberOfCounterMeasures: number;
  story?: string;
}

export class BlobGameFileRepository implements IBlobGameRepository {
  @Inject private logger!: LoggerService;
  @Inject private resourcesService!: ResourcesService;

  constructor(private guild: Guild) {}

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
    try {
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
      await this.resourcesService.saveGuildResource(
        this.guild,
        "blobGames.json",
        JSON.stringify(
          updatedBlobGames.map((updatedBlobGame) => {
            const toSave = {
              id: updatedBlobGame.getId(),
              dateCreated: updatedBlobGame.getDateCreated(),
              numberOfPlayers: updatedBlobGame.getNumberOfPlayers(),
              numberOfDamageDealtToBlob:
                updatedBlobGame.getNumberOfDamageDealtToBlob(),
              numberOfCluesOnAct1: updatedBlobGame.getNumberOfCluesOnAct1(),
              numberOfCounterMeasures:
                updatedBlobGame.getNumberOfCounterMeasures(),
            };

            if (updatedBlobGame.getStory())
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any
              (toSave as any).story = updatedBlobGame.getStory();

            if (updatedBlobGame.getDateEnded())
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any
              (toSave as any).dateEnded = updatedBlobGame.getDateEnded();

            return toSave;
          }),
          null,
          "  "
        )
      );
    } catch (err) {
      this.logger.error(err);
    }
  }

  public async load(): Promise<BlobGame[]> {
    try {
      if (
        !(await this.resourcesService.guildResourceExists(
          this.guild,
          "blobGames.json"
        ))
      ) {
        return [];
      }

      const raw = await this.resourcesService.readGuildResource(
        this.guild,
        "blobGames.json"
      );
      if (raw) {
        const parsed = JSON.parse(raw) as BlobGameSaved[];
        if (!BlobGameFileRepository.isValid(parsed)) {
          this.logger.error("Unable to parse blobGames.json");
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
          if (blobGameSaved.dateEnded)
            blobGame.endGame(new Date(blobGameSaved.dateEnded));
          return blobGame;
        });
      }
    } catch (err) {
      this.logger.error(err);
    }

    return [];
  }

  private static isValid(parsed: BlobGameSaved[]): boolean {
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
          typeof blobGame.story === "undefined") &&
        (typeof blobGame.dateEnded === "undefined" ||
          (typeof blobGame.dateEnded === "string" &&
            !isNaN(Date.parse(blobGame.dateEnded))))
    );
  }
}

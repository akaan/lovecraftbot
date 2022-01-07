import { Guild } from "discord.js";
import { Inject } from "typescript-ioc";

import { BlobGame } from "../domain/BlobGame";
import { IBlobGameRepository } from "../domain/IBlobGameRepository";

import { LoggerService } from "./LoggerService";
import { ResourcesService } from "./ResourcesService";

/**
 * Représentation d'une partie du Dévoreur sauvegardée sur fichier. Cette
 * structure ne contient que des types primitifs afin de pouvoir être
 * sauvegardée et chargée en JSON.
 */
interface BlobGameSaved {
  /** Identifiant de la partie */
  id: number;

  /** Date de création de la partie */
  dateCreated: string;

  /** Daye de fin de la partie */
  dateEnded?: string;

  /** Nombre de joueurs */
  numberOfPlayers: number;

  /** Nombre de dégâts infligés au Dévoreur */
  numberOfDamageDealtToBlob: number;

  /** Nombre d'indices placés sur l'acte 1 */
  numberOfCluesOnAct1: number;

  /** Nombre de contre-mesures */
  numberOfCounterMeasures: number;

  /** Histoire sélectionnée */
  story?: string;
}

/**
 * Implémentation avec sauvegarde sur fichier de l'entrepôt des parties du
 * Dévoreur
 */
export class BlobGameFileRepository implements IBlobGameRepository {
  /** Etiquette utilisée pour les logs de cet entrepôt */
  private static LOG_LABEL = "BlobGameFileRepository";

  @Inject private logger!: LoggerService;
  @Inject private resourcesService!: ResourcesService;

  /**
   * Un entrepôt de parties du Dévoreur est propre à un serveur.
   *
   * @param guild Le serveur sur lequel est instancié cet entrepôt.
   */
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
    } catch (error) {
      this.logger.error(
        BlobGameFileRepository.LOG_LABEL,
        "Erreur à la sauvegarde de la partie",
        { error }
      );
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
          this.logger.error(
            BlobGameFileRepository.LOG_LABEL,
            "Impossible de parser blobGames.json"
          );
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
    } catch (error) {
      this.logger.error(
        BlobGameFileRepository.LOG_LABEL,
        "Erreur au chargement des parties",
        { error }
      );
    }

    return [];
  }

  /**
   * Vérifie que l'ensemble de parties sauvegardées est valide en contrôlant
   * le type de chacun de ses attributs par rapport à l'attendu.
   *
   * @param parsed Un ensemble de parties sauvegardées à vérifier
   * @returns Vrai si l'ensemble est valide
   */
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

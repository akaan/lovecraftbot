import { BlobGame } from "./BlobGame";

/**
 * Interface d'un entrepôt pour les données de parties du Blob.
 */
export interface IBlobGameRepository {
  /**
   * Renvoie le prochain identifiant disponible.
   *
   * @returns Une promesse résolue avec le prochain identifiant disponible
   */
  nextId(): Promise<number>;

  /**
   * Récupère une partie par son identifiant.
   *
   * @param id L'identifiant de la partie
   * @returns Une promesse résolue avec la partie si disponible.
   */
  get(id: number): Promise<BlobGame | undefined>;

  /**
   * Sauvegarde une partie dans l'entrepôt.
   *
   * @param blobGame La partie à sauvegarder
   * @returns Une promesse résolue une fois la sauvegarde terminée
   */
  save(blobGame: BlobGame): Promise<void>;

  /**
   * Récupère l'ensemble des parties de l'entrepôt.
   *
   * @returns Une promesse résolue avec l'ensemble des parties
   */
  load(): Promise<BlobGame[]>;
}

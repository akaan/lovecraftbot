import axios from "axios";

import { GlobalResource } from "./GlobalResource";
import { ResourceParams } from "./ResourceParams";

/**
 * Paramètre de fonctionnement d'une ressources téléchargeable.
 */
interface DownloadableResourceParams<T> extends ResourceParams<T> {
  /** L'URL pour la récupération des dernières données */
  url: string;
}

/**
 * Une ressource globale qui peut se mettre à jour depuis une URL.
 */
export class DownloadableGlobalResource<T> extends GlobalResource<T> {
  constructor(params: DownloadableResourceParams<T>) {
    super(params);
  }

  /**
   * Récupère les paramètres de cette ressource.
   *
   * @returns Les paramètres de cette ressource
   */
  private getParams(): DownloadableResourceParams<T> {
    return this.params as DownloadableResourceParams<T>;
  }

  /**
   * Met à jour les données de cette ressource par téléchargement depuis l'URL.
   *
   * @returns Une promesse résolue une fois la ressource téléchargée.
   */
  public async download(): Promise<void> {
    try {
      const response = await axios.get<unknown>(this.getParams().url);
      await this.set(response.data as T);
    } catch (error) {
      this.getParams().logger.error(
        this.getParams().logLabel,
        `Erreur au téléchargement des données depuis ${this.getParams().url}`,
        { error }
      );
    }
  }
}

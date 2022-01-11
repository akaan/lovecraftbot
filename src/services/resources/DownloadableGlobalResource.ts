import axios from "axios";

import { GlobalResource } from "./GlobalResource";
import { ResourceParams } from "./ResourceParams";

/**
 * Une ressource globale qui peut se mettre à jour depuis une URL.
 */
export class DownloadableGlobalResource<T> extends GlobalResource<T> {
  /** L'URL pour la récupération des dernières données */
  private url: string;

  constructor(params: ResourceParams & { url: string }) {
    super(params);
    this.url = params.url;
  }

  /**
   * Met à jour les données de cette ressource par téléchargement depuis l'URL.
   *
   * @returns Une promesse résolue une fois la ressource téléchargée.
   */
  public async download(): Promise<void> {
    try {
      const response = await axios.get<unknown>(this.url);
      await this.set(response.data as T);
    } catch (error) {
      this.params.logger.error(
        this.params.logLabel,
        `Erreur au téléchargement des données depuis ${this.url}`,
        { error }
      );
    }
  }
}

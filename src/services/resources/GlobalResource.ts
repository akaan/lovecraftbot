import { ResourceParams } from "./ResourceParams";

/**
 * Une resource niveau global qui gère le chargement et la sauvegarde.
 *
 * @template T Le type de la valeur gérée par cette ressource.
 */
export class GlobalResource<T> {
  /** Les paramètres de cette ressource */
  protected params: ResourceParams;

  /** La valeur gérée */
  private value: T | undefined = undefined;

  /**
   * @param params Les paramètres pour le fonctionnement de cette ressource
   */
  constructor(params: ResourceParams) {
    this.params = params;
    void this.load();
  }

  /**
   * Récupère la valeur gérée par cette ressource.
   *
   * @returns La valeur s'il y en a une ou `undefined` sinon
   */
  public get(): T | undefined {
    return this.value;
  }

  /**
   * Positionne la valeur gérée par cette ressource.
   * La sauvegarde est faite dans la foulée et cette méthode échouera si la
   * sauvegarde a échoué : la valeur gardée en mémoire restera l'ancienne
   * valeur.
   *
   * @param value La valeur a positionner
   * @returns Une promesse résolue une fois la valeur positionnée
   */
  public async set(value: T): Promise<void> {
    const oldValue = this.value;
    try {
      this.value = value;
      await this.save();
    } catch (error) {
      this.value = oldValue;
    }
  }

  /**
   * Charge la ressource depuis le fichier.
   *
   * @returns Une promesse résolue une fois la ressource chargée
   */
  private async load(): Promise<void> {
    try {
      const resourceExists = await this.params.resourcesService.resourceExists(
        this.params.filename
      );

      if (resourceExists) {
        const raw = await this.params.resourcesService.readResource(
          this.params.filename
        );
        if (raw) {
          this.value = JSON.parse(raw) as T;
        }
      }
    } catch (error) {
      this.params.logger.error(
        this.params.logLabel,
        `Erreur au chargement de la ressource de serveur ${this.params.filename}`,
        { error }
      );
    }
  }

  /**
   * Sauvegarde la ressource sur le fichier.
   *
   * @returns Une promesse résolue une fois la ressource sauvegardée
   */
  private async save(): Promise<void> {
    if (!this.value) return;

    try {
      await this.params.resourcesService.saveResource(
        this.params.filename,
        JSON.stringify(this.value, null, "  ")
      );
    } catch (error) {
      this.params.logger.error(
        this.params.logLabel,
        `Erreur à la sauvegarde de la ressource de serveur ${this.params.filename}`,
        { error }
      );
    }
  }
}

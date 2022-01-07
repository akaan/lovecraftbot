import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

@Singleton
@OnlyInstantiableByContainer
/**
 * Un service pour tirer des nombres au hasard.
 */
export class RandomService extends BaseService {
  /**
   * Tirer un entier aléatoire compris entre le bornes inférieure et supérieure
   * indiquées.
   *
   * @param min La borne minimum (incluse)
   * @param max La borne maximuml (incluse)
   * @returns Un nombre entier compris entre `min` et `max`
   */
  public getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

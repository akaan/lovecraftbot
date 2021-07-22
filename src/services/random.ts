import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";
import { BaseService } from "../base/BaseService";

@Singleton
@OnlyInstantiableByContainer
export class RandomService extends BaseService {
  public getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

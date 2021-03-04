import axios from "axios";
import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";
import { BaseService } from "../base/BaseService";

@Singleton
@OnlyInstantiableByContainer
export class CardService extends BaseService {
  public getCardImageLink(cardId: string): Promise<string | undefined> {
    const possibleUrls = [
      `http://arkhamdb.fr.cr/IMAGES/CARTES/AH-${cardId}.jpg`,
      `http://arkhamdb.com/bundles/cards/${cardId}.jpg`,
      `http://arkhamdb.com/bundles/cards/${cardId}.png`,
    ];
    return this.getFirstWorkingUrl(possibleUrls);
  }

  private getFirstWorkingUrl(urls: string[]): Promise<string | undefined> {
    return urls.reduce((previous, next) => {
      return previous.then((maybeUrl) => {
        if (maybeUrl) {
          return Promise.resolve(maybeUrl);
        } else {
          return axios
            .head<string>(next)
            .then((response) => response.config.url)
            .catch(() => undefined as string | undefined);
        }
      });
    }, Promise.resolve(undefined as string | undefined));
  }
}

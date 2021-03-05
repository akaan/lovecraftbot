import axios from "axios";
import * as cheerio from "cheerio";
import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";
import { BaseService } from "../base/BaseService";

interface CardData {
  title: string;
  xp?: number;
  id: string;
}

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

  public async getCardsForTitle(searchString: string): Promise<CardData[]> {
    const escaped = encodeURIComponent(searchString);
    const url = `http://arkhamdb.fr.cr/recherche/${escaped}`;
    const searchResultPage = await axios.get<string>(url);
    const $ = cheerio.load(searchResultPage.data);

    const REGEX = /^([^(]+)(?: \((\d)\))?$/;

    const cards = $("table.tableau")
      // C'est toujours le dernier tableau qui contient la recherche par titre
      .last()
      .find("tbody tr")
      .map((_i, row) => {
        const cardTitleAndLink = $(row).find("td").first();
        const cardTitleAndXp = cardTitleAndLink.text().trim();
        const cardLink = cardTitleAndLink.find("a").attr("href");
        const [, cardTitle, maybeCardXp] = REGEX.exec(cardTitleAndXp);
        const parsedXp = parseInt(maybeCardXp, 10);
        return {
          title: cardTitle,
          xp: isNaN(parsedXp) ? undefined : parsedXp,
          id: cardLink.split("/")[4],
        } as CardData;
      })
      .get();
    return cards as CardData[];
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

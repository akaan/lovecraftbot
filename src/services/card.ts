import axios from "axios";
import * as cheerio from "cheerio";
import * as Discord from "discord.js";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";
import { BaseService } from "../base/BaseService";
import { ResourcesService } from "./resources";
import { LoggerService } from "./logger";

interface CardData {
  title: string;
  xp?: number;
  id: string;
}

interface ArkhamDBCard {
  name: string;
  real_name: string;
  code: string;
  faction: string;
  xp: number;
  double_sided: boolean;
  imagesrc: string;
  backimagesrc: string;
}

@Singleton
@OnlyInstantiableByContainer
export class CardService extends BaseService {
  @Inject logger: LoggerService;
  @Inject resources: ResourcesService;
  private frenchCards: ArkhamDBCard[] = [];

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);

    await this.loadCards();
  }

  public getCardsByNameOrRealName(search: string): ArkhamDBCard[] {
    return this.frenchCards.filter(
      (card) =>
        card.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        card.real_name.toLowerCase().includes(search.trim().toLowerCase())
    );
  }

  public getCardByCode(code: string): ArkhamDBCard | undefined {
    return this.frenchCards.find((c) => c.code === code);
  }

  public getFrenchCardImage(code: string): Promise<string | undefined> {
    return axios
      .head<string>(`http://arkhamdb.fr.cr/IMAGES/CARTES/AH-${code}.jpg`)
      .then((response) => response.config.url)
      .catch(() => undefined as string | undefined);
  }

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

  private async loadCards() {
    const rawData = await this.resources.readResource("cards.fr.json");
    if (rawData) {
      try {
        this.frenchCards = JSON.parse(rawData) as ArkhamDBCard[];
      } catch (err) {
        this.logger.error(err);
      }
    }
  }
}

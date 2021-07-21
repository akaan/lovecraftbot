import axios from "axios";
import * as Discord from "discord.js";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";
import { BaseService } from "../base/BaseService";
import { ResourcesService } from "./resources";
import { LoggerService } from "./logger";

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
  private frenchCards: ArkhamDBCard[] = [];

  @Inject logger?: LoggerService;
  @Inject resources?: ResourcesService;

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

  public getCardImage(card: ArkhamDBCard): Promise<string | undefined> {
    return axios
      .head<string>(`https://arkhamdb.com${card.imagesrc}`)
      .then((response) => response.config.url)
      .catch(() => undefined as string | undefined);
  }

  public async downloadLatestCardDb(): Promise<void> {
    if (!this.resources) {
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await axios.get<any[]>(
        "https://fr.arkhamdb.com/api/public/cards/?encounter=true"
      );
      await this.resources.saveResource(
        "cards.fr.json",
        JSON.stringify(response.data)
      );
      await this.loadCards();
    } catch (error) {
      if (this.logger) {
        this.logger.error(error);
      }
    }
  }

  private async loadCards() {
    if (!this.resources) {
      return;
    }

    const rawData = await this.resources.readResource("cards.fr.json");
    if (rawData) {
      try {
        this.frenchCards = JSON.parse(rawData) as ArkhamDBCard[];
      } catch (err) {
        if (this.logger) this.logger.error(err);
      }
    }
  }
}

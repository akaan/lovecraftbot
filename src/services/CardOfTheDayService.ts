import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";
import * as Discord from "discord.js";

import { BaseService } from "../base/BaseService";
import { CardPool, CardService, SearchType } from "./CardService";
import { EnvService } from "./EnvService";
import { LoggerService } from "./LoggerService";
import { RandomService } from "./RandomService";
import { ResourcesService } from "./ResourcesService";

@Singleton
@OnlyInstantiableByContainer
export class CardOfTheDayService extends BaseService {
  private cardCodesSent: string[] = [];

  @Inject private cardService!: CardService;
  @Inject private envService!: EnvService;
  @Inject private logger!: LoggerService;
  @Inject private randomService!: RandomService;
  @Inject private resourcesService!: ResourcesService;

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);

    if (!this.envService.cardOfTheDayChannelId) {
      if (this.logger) {
        this.logger.log(
          `[CardOfTheDayService] Pas d'ID de channel pour la carte du jour.`
        );
      }
      return;
    }

    await this.loadCardCodesSent();
    this.start();
  }

  public start(): void {
    if (!this.client) {
      return;
    }
    const cardOfTheDayHour = this.envService.cardOfTheDayHour;

    this.client.setInterval(() => {
      const now = new Date();
      if (now.getHours() == cardOfTheDayHour && now.getMinutes() == 0) {
        this.sendCardOfTheDay().catch((err) => this.logger.error(err));
      }
    }, 1000 * 60);

    this.logger.log(
      `[CardOfTheDayService] La carte du jour sera envoyée chaque jour à ${cardOfTheDayHour}H.`
    );
  }

  private async sendCardOfTheDay(): Promise<void> {
    if (!this.client) {
      return;
    }

    if (this.envService.cardOfTheDayChannelId) {
      const channel = await this.client.channels.fetch(
        this.envService.cardOfTheDayChannelId
      );
      if (channel) {
        const allCodes = this.cardService.getAllPlayerCardCodes();
        const remainingCodes = allCodes.filter(
          (code) => !this.cardCodesSent.includes(code)
        );
        const randomCode =
          remainingCodes[
            this.randomService.getRandomInt(0, remainingCodes.length)
          ];
        const randomCard = this.cardService.getCards({
          searchString: randomCode,
          searchCardPool: CardPool.PLAYER,
          searchType: SearchType.BY_CODE,
        });
        if (randomCard.length > 0) {
          const embed = await this.cardService.createEmbed(randomCard[0], {
            back: false,
            extended: true,
          });
          await (channel as Discord.TextChannel).send(embed);
          this.cardCodesSent.push(randomCode);
          await this.saveCardCodesSent();

          this.logger.log(`[CardOfTheDayService] Carte du jour envoyée.`);
        } else {
          this.logger.log(
            `[CardOfTheDayService] Problème lors de la récupération de la carte du jour (code: ${randomCode}).`
          );
        }
      } else {
        this.logger.log(
          `[CardOfTheDayService] Le channel d'ID ${this.envService.cardOfTheDayChannelId} n'a pas été trouvé.`
        );
      }
    }
  }

  private async loadCardCodesSent() {
    const dataAvailable = await this.resourcesService.resourceExists(
      "cardOfTheDay.json"
    );
    if (dataAvailable) {
      const rawData = await this.resourcesService.readResource(
        "cardOfTheDay.json"
      );
      if (rawData) {
        try {
          this.cardCodesSent = JSON.parse(rawData) as string[];
        } catch (err) {
          if (this.logger) this.logger.error(err);
        }
      }
    }
  }

  private async saveCardCodesSent() {
    await this.resourcesService.saveResource(
      "cardOfTheDay.json",
      JSON.stringify(this.cardCodesSent)
    );
  }
}

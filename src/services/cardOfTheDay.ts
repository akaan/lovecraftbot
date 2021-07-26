import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";
import * as Discord from "discord.js";

import { BaseService } from "../base/BaseService";
import { CardService } from "./card";
import { EnvService } from "./env";
import { LoggerService } from "./logger";
import { RandomService } from "./random";
import { ResourcesService } from "./resources";

@Singleton
@OnlyInstantiableByContainer
export class CardOfTheDayService extends BaseService {
  @Inject private cardService?: CardService;
  @Inject private envService?: EnvService;
  @Inject private logger?: LoggerService;
  @Inject private randomService?: RandomService;
  @Inject private resourcesService?: ResourcesService;
  private cardCodesSent: string[] = [];

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);

    if (!this.envService) {
      return;
    }

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
    if (!this.envService || !this.client) {
      return;
    }
    const cardOfTheDayHour = this.envService.cardOfTheDayHour;

    this.client.setInterval(() => {
      const now = new Date();
      if (now.getHours() == cardOfTheDayHour) {
        this.sendCardOfTheDay().catch(console.log);
      }
    }, 1000 * 60);

    if (this.logger) {
      this.logger.log(
        `[CardOfTheDayService] La carte du jour sera envoyée chaque jour à ${cardOfTheDayHour}H.`
      );
    }
  }

  private async sendCardOfTheDay(): Promise<void> {
    if (
      !this.client ||
      !this.envService ||
      !this.cardService ||
      !this.randomService
    ) {
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
        const randomCard = this.cardService.getCardByCode(randomCode);
        if (randomCard) {
          const embed = await this.cardService.createEmbed(
            randomCard,
            false,
            true
          );
          await (channel as Discord.TextChannel).send(embed);
          this.cardCodesSent.push(randomCode);
          await this.saveCardCodesSent();

          if (this.logger) {
            this.logger.log(`[CardOfTheDayService] Carte du jour envoyée.`);
          }
        } else {
          if (this.logger) {
            this.logger.log(
              `[CardOfTheDayService] Problème lors de la récupération de la carte du jour (code: ${randomCode}).`
            );
          }
        }
      } else {
        if (this.logger) {
          this.logger.log(
            `[CardOfTheDayService] Le channel d'ID ${this.envService.cardOfTheDayChannelId} n'a pas été trouvé.`
          );
        }
      }
    }
  }

  private async loadCardCodesSent() {
    if (!this.resourcesService) {
      return;
    }

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
    if (!this.resourcesService) {
      return;
    }
    await this.resourcesService.saveResource(
      "cardOfTheDay.json",
      JSON.stringify(this.cardCodesSent)
    );
  }
}

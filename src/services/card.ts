import axios from "axios";
import diacritics from "diacritics";
import * as Discord from "discord.js";
import Fuse from "fuse.js";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";

import { BaseService } from "../base/BaseService";
import { FormatService } from "./format";
import { ResourcesService } from "./resources";
import { LoggerService } from "./logger";

const CLASS_COLORS = {
  guardian: 0x2b80c5,
  seeker: 0xff8f3f,
  rogue: 0x107116,
  mystic: 0x6d2aa9,
  survivor: 0xcc3038,
  neutral: 0x808080,
  mythos: 0xfcfcfc,
};

export interface ArkhamDBCard {
  code: string;
  name: string;
  real_name: string;
  xp: number;
  permanent: boolean;
  double_sided: boolean;
  faction_code:
    | "guardian"
    | "seeker"
    | "rogue"
    | "mystic"
    | "survivor"
    | "neutral"
    | "mythos";
  type_code: string;
  pack_code: string;
  text: string;
  imagesrc: string;
  back_text: string;
  backimagesrc: string;
  skill_willpower: number;
  skill_intellect: number;
  skill_combat: number;
  skill_agility: number;
  skill_wild: number;
  cost: string;
  slot: string;
}

interface CodeAndName {
  code: string;
  name: string;
}

function findOrDefaultToCode(dict: CodeAndName[], search: string): string {
  const found = dict.find((codeAndName) => codeAndName.code === search);
  if (found) {
    return found.name;
  }
  return search;
}

@Singleton
@OnlyInstantiableByContainer
export class CardService extends BaseService {
  private frenchCards: ArkhamDBCard[] = [];
  private factions: CodeAndName[] = [];
  private packs: CodeAndName[] = [];
  private types: CodeAndName[] = [];
  private playerCardsIndex: Fuse<ArkhamDBCard> = new Fuse<ArkhamDBCard>([]);

  @Inject formatService?: FormatService;
  @Inject logger?: LoggerService;
  @Inject resources?: ResourcesService;

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);

    await this.loadCards();
    await this.loadFactions();
    await this.loadPacks();
    await this.loadTypes();
  }

  public getCards(search: string): ArkhamDBCard[] {
    const foundCard = this.playerCardsIndex.search(diacritics.remove(search))[0]
      .item;
    return this.frenchCards.filter((card) => card.name === foundCard.name);
  }

  public hasBack(card: ArkhamDBCard): boolean {
    return !!card.back_text || !!card.backimagesrc;
  }

  public async createEmbed(
    card: ArkhamDBCard,
    back: boolean,
    extended = false
  ): Promise<Discord.MessageEmbed> {
    const embed = new Discord.MessageEmbed();

    const cardFaction = findOrDefaultToCode(this.factions, card.faction_code);
    const cardType = findOrDefaultToCode(this.types, card.type_code);

    embed.setTitle(card.name);
    embed.setURL(`https://fr.arkhamdb.com/card/${card.code}`);

    if (!["neutral", "mythos"].includes(card.faction_code)) {
      embed.setAuthor(
        `${cardType} ${cardFaction}`,
        `https://arkhamdb.com/bundles/app/images/factions/${card.faction_code}.png`
      );
    } else {
      embed.setAuthor(`${cardType} ${cardFaction}`);
    }

    embed.setColor(CLASS_COLORS[card.faction_code]);

    const maybeCardImageLink = await this.getCardImageLink(card, back);
    if (maybeCardImageLink) {
      embed.setImage(maybeCardImageLink);
    }

    const cardText = back ? card.back_text : card.text;

    if (extended || !maybeCardImageLink) {
      if (cardText) {
        if (this.formatService) {
          embed.setDescription(this.formatService.format(cardText));
        } else {
          embed.setDescription(cardText);
        }
      }

      if (!back) {
        if (card.xp) {
          embed.addField("Niveau", card.xp, true);
        }

        if (card.type_code !== "investigator" && this.formatService) {
          const icons =
            "[willpower]".repeat(card.skill_willpower || 0) +
            "[intellect]".repeat(card.skill_intellect || 0) +
            "[combat]".repeat(card.skill_combat || 0) +
            "[agility]".repeat(card.skill_agility || 0) +
            "[wild]".repeat(card.skill_wild || 0);
          embed.addField(
            "Icônes",
            icons !== "" ? this.formatService.format(icons) : "-",
            true
          );
        }

        if (card.cost) {
          embed.addField("Coût", card.cost, true);
        }

        const maybePack = this.packs.find(
          (pack) => pack.code == card.pack_code
        );
        if (maybePack) {
          embed.addField("Pack", maybePack.name);
        }

        embed.addField("Nom anglais", card.real_name);
      }
    }

    if (!back && this.hasBack(card)) {
      embed.setFooter("Cette carte a un dos.");
    }

    return embed;
  }

  public getCardByCode(code: string): ArkhamDBCard | undefined {
    return this.frenchCards.find((c) => c.code === code);
  }

  private async getCardImageLink(
    card: ArkhamDBCard,
    back = false
  ): Promise<string | undefined> {
    const maybeFrenchImageLink = await this.getFrenchCardImageLink(card, back);
    if (maybeFrenchImageLink) {
      return maybeFrenchImageLink;
    } else {
      const maybeEnglishImageLink = await this.getEnglishCardImageLink(
        card,
        back
      );
      if (maybeEnglishImageLink) {
        return maybeEnglishImageLink;
      }
    }
  }

  private getFrenchCardImageLink(
    card: ArkhamDBCard,
    back = false
  ): Promise<string | undefined> {
    return axios
      .head<string>(
        `http://arkhamdb.fr.cr/IMAGES/CARTES/AH-${card.code}${
          back ? "_back" : ""
        }.jpg`
      )
      .then((response) => response.config.url)
      .catch(() => undefined as string | undefined);
  }

  private getEnglishCardImageLink(
    card: ArkhamDBCard,
    back = false
  ): Promise<string | undefined> {
    return axios
      .head<string>(
        `https://arkhamdb.com${back ? card.backimagesrc : card.imagesrc}`
      )
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

  private async loadFactions() {
    if (!this.resources) {
      return;
    }
    const rawData = await this.resources.readResource("factions.json");
    if (rawData) {
      try {
        this.factions = JSON.parse(rawData) as CodeAndName[];
      } catch (err) {
        if (this.logger) this.logger.error(err);
      }
    }
  }

  private async loadPacks() {
    if (!this.resources) {
      return;
    }
    const rawData = await this.resources.readResource("packs.json");
    if (rawData) {
      try {
        this.packs = JSON.parse(rawData) as CodeAndName[];
      } catch (err) {
        if (this.logger) this.logger.error(err);
      }
    }
  }

  private async loadTypes() {
    if (!this.resources) {
      return;
    }
    const rawData = await this.resources.readResource("types.json");
    if (rawData) {
      try {
        this.types = JSON.parse(rawData) as CodeAndName[];
      } catch (err) {
        if (this.logger) this.logger.error(err);
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

        const playerCards = this.frenchCards.filter(
          (card) => card.faction_code !== "mythos"
        );

        this.playerCardsIndex = new Fuse<ArkhamDBCard>(playerCards, {
          keys: ["real_name", "name"],
          getFn: function (...args) {
            return diacritics.remove(
              /* eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
              (Fuse as any).config.getFn.apply(this, args)
            );
          },
        });
      } catch (err) {
        if (this.logger) this.logger.error(err);
      }
    }
  }
}

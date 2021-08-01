import axios from "axios";
import diacritics from "diacritics";
import * as Discord from "discord.js";
import Fuse from "fuse.js";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";

import { BaseService } from "../base/BaseService";
import { FormatService } from "./FormatService";
import { ResourcesService } from "./ResourcesService";
import { LoggerService } from "./LoggerService";

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

interface ArkhamDBTaboo {
  start_date: string;
  cards: string;
}

interface Taboo {
  code: string;
  xp: number;
  text: string;
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

export enum SearchType {
  BY_CODE,
  BY_TITLE,
}

export enum CardPool {
  PLAYER,
  ENCOUNTER,
}

interface SearchParams {
  searchString: string;
  searchType?: SearchType;
  searchCardPool?: CardPool;
  includeSameNameCards?: boolean;
}

interface EmbedOptions {
  extended: boolean;
  back: boolean;
}

@Singleton
@OnlyInstantiableByContainer
export class CardService extends BaseService {
  private frenchCards: ArkhamDBCard[] = [];
  private taboos: Taboo[] = [];
  private factions: CodeAndName[] = [];
  private packs: CodeAndName[] = [];
  private types: CodeAndName[] = [];
  private playerCardsIndex: Fuse<ArkhamDBCard> = new Fuse<ArkhamDBCard>([]);
  private encounterCardsIndex: Fuse<ArkhamDBCard> = new Fuse<ArkhamDBCard>([]);

  @Inject private formatService!: FormatService;
  @Inject private logger!: LoggerService;
  @Inject private resources!: ResourcesService;

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);

    await this.loadCards();
    await this.loadTaboos();
    await this.loadFactions();
    await this.loadPacks();
    await this.loadTypes();
  }

  public getCards({
    searchString,
    searchType = SearchType.BY_TITLE,
    searchCardPool = CardPool.PLAYER,
    includeSameNameCards = false,
  }: SearchParams): ArkhamDBCard[] {
    if (searchType === SearchType.BY_CODE) {
      const factionFilter =
        searchCardPool === CardPool.PLAYER
          ? (card: ArkhamDBCard) => card.faction_code !== "mythos"
          : (card: ArkhamDBCard) => card.faction_code === "mythos";
      return this.frenchCards
        .filter(factionFilter)
        .filter((card) => card.code === searchString);
    }

    const cardsIndex =
      searchCardPool === CardPool.PLAYER
        ? this.playerCardsIndex
        : this.encounterCardsIndex;
    const foundCards = cardsIndex.search(diacritics.remove(searchString));
    if (foundCards.length > 0) {
      const foundCard = foundCards[0].item;
      if (!includeSameNameCards) {
        return [foundCard];
      } else {
        return this.frenchCards.filter((card) => card.name === foundCard.name);
      }
    }

    return [];
  }

  public getAllPlayerCardCodes(): string[] {
    return this.frenchCards
      .filter((card) => card.faction_code !== "mythos")
      .map((card) => card.code);
  }

  public hasBack(card: ArkhamDBCard): boolean {
    return !!card.back_text || !!card.backimagesrc;
  }

  public async createEmbed(
    card: ArkhamDBCard,
    embedOptions: EmbedOptions
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

    const maybeCardImageLink = await this.getCardImageLink(
      card,
      embedOptions.back
    );
    if (maybeCardImageLink) {
      embed.setImage(maybeCardImageLink);
    }

    const cardText = embedOptions.back ? card.back_text : card.text;

    if (embedOptions.extended || !maybeCardImageLink) {
      if (cardText) {
        embed.setDescription(this.formatService.format(cardText));
      }

      if (!embedOptions.back) {
        if (card.xp) {
          embed.addField("Niveau", card.xp, true);
        }

        if (
          card.faction_code !== "mythos" &&
          card.type_code !== "investigator" &&
          this.formatService
        ) {
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

    const maybeTaboo = this.taboos.find((taboo) => taboo.code === card.code);
    if (maybeTaboo) {
      const tabooText = [];
      if (maybeTaboo.xp) {
        tabooText.push(`XP: ${maybeTaboo.xp}`);
      }
      if (maybeTaboo.text) {
        tabooText.push(this.formatService.format(maybeTaboo.text));
      }
      embed.addField("Taboo", tabooText.join("\n"));
    }

    if (!embedOptions.back && this.hasBack(card)) {
      embed.setFooter("Cette carte a un dos.");
    }

    return embed;
  }

  public async downloadLatestCardDb(): Promise<void> {
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
      this.logger.error(error);
    }
  }

  public async downloadLatestTaboos(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await axios.get<any[]>(
        "https://fr.arkhamdb.com/api/public/taboos"
      );
      await this.resources.saveResource(
        "taboos.json",
        JSON.stringify(response.data)
      );
      await this.loadCards();
    } catch (error) {
      this.logger.error(error);
    }
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

  private async loadFactions() {
    const rawData = await this.resources.readResource("factions.json");
    if (rawData) {
      try {
        this.factions = JSON.parse(rawData) as CodeAndName[];
      } catch (err) {
        this.logger.error(err);
      }
    }
  }

  private async loadPacks() {
    const rawData = await this.resources.readResource("packs.json");
    if (rawData) {
      try {
        this.packs = JSON.parse(rawData) as CodeAndName[];
      } catch (err) {
        this.logger.error(err);
      }
    }
  }

  private async loadTypes() {
    const rawData = await this.resources.readResource("types.json");
    if (rawData) {
      try {
        this.types = JSON.parse(rawData) as CodeAndName[];
      } catch (err) {
        this.logger.error(err);
      }
    }
  }

  private async loadCards() {
    const dataAvailable = await this.resources.resourceExists("cards.fr.json");
    if (!dataAvailable) {
      await this.downloadLatestCardDb();
    }

    const rawData = await this.resources.readResource("cards.fr.json");
    if (rawData) {
      try {
        this.frenchCards = JSON.parse(rawData) as ArkhamDBCard[];

        const playerCards = this.frenchCards.filter(
          (card) => card.faction_code !== "mythos"
        );

        const encounterCards = this.frenchCards.filter(
          (card) => card.faction_code == "mythos"
        );

        const indexOptions: Fuse.IFuseOptions<ArkhamDBCard> = {
          keys: ["real_name", "name"],
          getFn: function (...args) {
            return diacritics.remove(
              /* eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
              (Fuse as any).config.getFn.apply(this, args)
            );
          },
        };

        this.playerCardsIndex = new Fuse<ArkhamDBCard>(
          playerCards,
          indexOptions
        );
        this.encounterCardsIndex = new Fuse<ArkhamDBCard>(
          encounterCards,
          indexOptions
        );
      } catch (err) {
        this.logger.error(err);
      }
    }
  }

  private async loadTaboos() {
    const dataAvailable = await this.resources.resourceExists("taboos.json");
    if (!dataAvailable) {
      await this.downloadLatestTaboos();
    }

    const rawData = await this.resources.readResource("taboos.json");
    if (rawData) {
      try {
        const allTaboos = JSON.parse(rawData) as ArkhamDBTaboo[];
        if (allTaboos.length > 0) {
          const latestTaboo = allTaboos[0];
          this.taboos = JSON.parse(latestTaboo.cards) as Taboo[];
        }
      } catch (err) {
        this.logger.error(err);
      }
    }
  }
}

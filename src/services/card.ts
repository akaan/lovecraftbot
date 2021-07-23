import axios from "axios";
import diacritics from "diacritics";
import * as Discord from "discord.js";
import Fuse from "fuse.js";
import TurndownService from "turndown";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";

import { BaseService } from "../base/BaseService";
import { EmojiService } from "./emoji";
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

const ICONS: { [key: string]: string } = {
  guardian: "ClassGuardian",
  seeker: "ClassSeeker",
  rogue: "ClassRogue",
  mystic: "ClassMystic",
  survivor: "ClassSurvivor",
  reaction: "ResponseAction",
  action: "Action",
  fast: "FastAction",
  willpower: "SkillWillpower",
  intellect: "SkillIntellect",
  combat: "SkillCombat",
  agility: "SkillAgility",
  elder_sign: "ChaosElderSign",
  skull: "ChaosSkull",
  cultist: "ChaosCultist",
  tablet: "ChaosTablet",
  elder_thing: "ChaosElderOne",
  auto_fail: "ChaosFail",
  bless: "bless",
  curse: "curse",
};

export interface ArkhamDBCard {
  code: string;
  name: string;
  real_name: string;
  xp: number;
  faction_code:
    | "guardian"
    | "seeker"
    | "rogue"
    | "mystic"
    | "survivor"
    | "neutral"
    | "mythos";
  imagesrc: string;
  backimagesrc: string;
  text: string;
  cost: string;
  type_code: string;
  pack_code: string;
  double_sided: boolean;
}

interface CodeAndName {
  code: string;
  name: string;
}

@Singleton
@OnlyInstantiableByContainer
export class CardService extends BaseService {
  private frenchCards: ArkhamDBCard[] = [];
  private factions: CodeAndName[] = [];
  private packs: CodeAndName[] = [];
  private types: CodeAndName[] = [];
  private fuse: Fuse<ArkhamDBCard> = new Fuse<ArkhamDBCard>([]);
  private turndownService = new TurndownService();

  @Inject emojiService?: EmojiService;
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
    const foundCard = this.fuse.search(diacritics.remove(search))[0].item;
    return this.frenchCards.filter((card) => card.name === foundCard.name);
  }

  public async createEmbed(card: ArkhamDBCard): Promise<Discord.MessageEmbed> {
    const embed = new Discord.MessageEmbed();
    if (!["neutral", "mythos"].includes(card.faction_code)) {
      embed.attachFiles([
        `https://arkhamdb.com/bundles/app/images/factions/${card.faction_code}.png`,
      ]);
      embed.setAuthor(card.name, `attachment://${card.faction_code}.png`);
    } else {
      embed.setAuthor(card.name);
    }

    if (card.text) {
      embed.setDescription(
        this.turndownService.turndown(this.formatTextForEmojis(card.text))
      );
    }
    embed.setColor(CLASS_COLORS[card.faction_code]);

    embed.addField("Nom anglais", card.real_name);

    const maybeFaction = this.factions.find(
      (faction) => faction.code == card.faction_code
    );
    if (maybeFaction) {
      embed.addField("Faction", maybeFaction.name);
    }

    if (card.xp) {
      embed.addField("Niveau", card.xp);
    }

    const maybeType = this.types.find((type) => type.code == card.type_code);
    if (maybeType) {
      embed.addField("Type", maybeType.name);
    }

    if (card.cost) {
      embed.addField("Coût", card.cost);
    }

    const maybePack = this.packs.find((pack) => pack.code == card.pack_code);
    if (maybePack) {
      embed.addField("Pack", maybePack.name);
    }

    const maybeFrenchImage = await this.getFrenchCardImage(card.code);
    if (maybeFrenchImage) {
      embed.setImage(maybeFrenchImage);
    } else {
      const maybeImage = await this.getCardImage(card);
      if (maybeImage) {
        embed.setImage(maybeImage);
      }
    }

    return embed;
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

  private formatTextForEmojis(text: string): string {
    if (!this.emojiService) {
      return text;
    }
    const emojiService = this.emojiService;

    const matches = text.match(/\[[^\]]+\]/g);
    if (!matches || !matches[0]) {
      return text;
    }

    matches.forEach((match) => {
      const arkhamdbCode = match.substring(1, match.length - 1);
      const frenchCode = ICONS[arkhamdbCode];
      if (frenchCode) {
        const maybeEmoji = emojiService.getEmoji(frenchCode);
        if (maybeEmoji) {
          text = text.replace(match, maybeEmoji);
        }
      }
    });

    return text;
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

        this.fuse = new Fuse<ArkhamDBCard>(this.frenchCards, {
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

import TurndownService from "turndown";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";
import { LoggerService } from "./logger";
import { EmojiService } from "./emoji";

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

@Singleton
@OnlyInstantiableByContainer
export class FormatService extends BaseService {
  @Inject logger?: LoggerService;
  @Inject emojiService?: EmojiService;
  private turndownService = new TurndownService();

  public format(text: string): string {
    return this.turndownService.turndown(this.formatTextForEmojis(text));
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
}

import TurndownService from "turndown";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";
import { LoggerService } from "./LoggerService";
import { EmojiService } from "./EmojiService";

const ICONS: { [key: string]: string } = {
  guardian: "ClassGuardian",
  seeker: "ClassSeeker",
  rogue: "ClassRogue",
  mystic: "ClassMystic",
  survivor: "ClassSurvivor",
  reaction: "ResponseAction",
  action: "Action",
  fast: "FastAction",
  free: "FastAction",
  willpower: "SkillWillpower",
  intellect: "SkillIntellect",
  combat: "SkillCombat",
  agility: "SkillAgility",
  wild: "SkillWild",
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
    const withLineBreaks = this.formatTextForLineBreaks(text);
    const withTraits = this.formatTextForTraits(withLineBreaks);
    const withEmoji = this.formatTextForEmojis(withTraits);
    return this.turndownService.turndown(withEmoji);
  }

  private formatTextForLineBreaks(text: string): string {
    return text.replace(/\n/g, "<br/>");
  }

  private formatTextForTraits(text: string): string {
    const matches = text.match(/\[\[[^\]]+\]\]/g);

    if (!matches || !matches[0]) {
      return text;
    }

    matches.forEach((match) => {
      const trait = match.substring(2, match.length - 2);
      text = text.replace(match, `<b><i>${trait}</i></b>`);
    });

    return text;
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

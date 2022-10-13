import TurndownService from "turndown";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { EmojiService } from "./EmojiService";

/**
 * Ensemble des icônes pouvant apparaître dans un message. Ce sont les codes
 * qu'on retrouve dans le texte des cartes notamment.
 */
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
  hand: "Slot1Hand",
  "hand x2": "Slot2Hand",
  accessory: "SlotAccessoty",
  ally: "SlotAlly",
  arcane: "Slot1Arcane",
  "arcane x2": "Slot2Arcane",
  body: "SlotBody",
  tarot: "SlotTarot",
  damage: "TokenDamage",
  horror: "TokenHorror",
};

@Singleton
@OnlyInstantiableByContainer
/**
 * Service permettant le formatage des descriptions issues d'ArkhamDB. En
 * effet celles-ci contiennent différents codes ou balises de formatage
 * qu'il faut retravailler pour un affichage correct dans un message Discord.
 */
export class FormatService extends BaseService {
  /** Service permettant de transcrire du HTML en Markdown */
  private turndownService = new TurndownService();

  @Inject private emojiService!: EmojiService;

  /**
   * Formate la description pour un affichage dans un message Discord.
   *
   * @param text Description contenant icônes et balises
   * @returns Texte prêt à l'affichage dans un message Discord
   */
  public format(text: string): string {
    const withLineBreaks = this.formatTextForLineBreaks(text);
    const withTraits = this.formatTextForTraits(withLineBreaks);
    const withEmoji = this.formatTextForEmojis(withTraits);
    return this.turndownService.turndown(withEmoji);
  }

  /**
   * Remplace les icônes présentes de le texte sous forme de balises HTML
   * `span` par des Emojis. Utile pour les entrées de FAQ.
   *
   * @param text Texte contenant des icônes au format HTML
   * @returns Texte avec les icônes remplacées par des Emojis
   */
  public replaceIcons(text: string): string {
    return text.replace(
      /<span class="icon-([^"]+)"><\/span>/g,
      (_html: string, arkhamdbCode: string) => {
        const frenchCode = ICONS[arkhamdbCode];
        if (frenchCode) {
          const maybeEmoji = this.emojiService.getEmoji(frenchCode);
          if (maybeEmoji) {
            return maybeEmoji;
          }
        }
        return `[${arkhamdbCode}]`;
      }
    );
  }

  /**
   * Remplace les sauts de lignes classique par des sauts de lignes HTML.
   *
   * @param text Texte avec sauts de lignes
   * @returns Texte avec saut de ligne HTML
   */
  private formatTextForLineBreaks(text: string): string {
    return text.replace(/\n/g, "<br/>");
  }

  /**
   * Repère dans le texte fourni les traits de cartes entourés de doubles
   * crochets et les remplace par des balises HTML.
   *
   * @param text Texte contenant des traits de cartes
   * @returns Texte avec traits entourées de balises HTML
   */
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

  /**
   * Repère les codes d'icônes (entre crochets) dans le texte fourni
   * et les remplace par les Emojis correspondant.
   *
   * @param text Texte contenant des codes d'icônes
   * @returns Texte avec un affichage des icônes sous forme d'Emojis
   */
  private formatTextForEmojis(text: string): string {
    const matches = text.match(/\[[^\]]+\]/g);
    if (!matches || !matches[0]) {
      return text;
    }

    matches.forEach((match) => {
      const arkhamdbCode = match.substring(1, match.length - 1);
      const frenchCode = ICONS[arkhamdbCode];
      if (frenchCode) {
        const maybeEmoji = this.emojiService.getEmoji(frenchCode);
        if (maybeEmoji) {
          text = text.replace(match, maybeEmoji);
        }
      }
    });

    return text;
  }
}

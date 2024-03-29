import axios from "axios";
import * as Discord from "discord.js";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { FormatService } from "./FormatService";
import { LoggerService } from "./LoggerService";
import { DownloadableGlobalResource } from "./resources/DownloadableGlobalResource";
import { GlobalResource } from "./resources/GlobalResource";
import { ResourcesService } from "./ResourcesService";

/** Couleurs associées au différentes classes */
const CLASS_COLORS = {
  guardian: 0x2b80c5,
  seeker: 0xff8f3f,
  rogue: 0x107116,
  mystic: 0x6d2aa9,
  survivor: 0xcc3038,
  multiclass: 0xc0c000,
  neutral: 0x808080,
  mythos: 0xfcfcfc,
};

/** Classe Horreur à Arkham */
export type FactionCode =
  | "guardian"
  | "seeker"
  | "rogue"
  | "mystic"
  | "survivor"
  | "neutral"
  | "mythos";

/**
 * Une carte renvoyée par l'API d'ArkhamDB
 */
export interface ArkhamDBCard {
  code: string;
  name: string;
  real_name: string;
  xp: number;
  permanent: boolean;
  double_sided: boolean;
  faction_code: FactionCode;
  faction2_code?: FactionCode;
  faction3_code?: FactionCode;
  encounter_code?: string;
  type_code: string;
  pack_code: string;
  text: string;
  imagesrc: string;
  back_text: string;
  backimagesrc: string;
  customization_text: string;
  skill_willpower: number;
  skill_intellect: number;
  skill_combat: number;
  skill_agility: number;
  skill_wild: number;
  cost: string;
  slot: string;
  health: number;
  sanity: number;
}

/**
 * Type représentant une liste Taboo
 */
interface ArkhamDBTaboo {
  /** Date de publication de cette liste Taboo */
  start_date: string;

  /** Contenu de la liste Taboo */
  cards: string;
}

/**
 * Type représentant les modifications apportées à une carte par une liste
 * Taboo.
 */
interface Taboo {
  /** Code de la carte */
  code: string;

  /** Points d'XP ajoutés ou retirés */
  xp: number;

  /** Description des modifications apportées */
  text: string;
}

/**
 * Type représentant une entrée de FAQ pour une carte.
 */
interface CardFAQEntry {
  /** Le texte de la FAQ */
  text: string;
}

/**
 * Type générique pour tout ce qui a un code et un nom
 */
interface CodeAndName {
  /** Le code */
  code: string;
  /** Le nom */
  name: string;
}

/**
 * Recherche un code dans une liste de paires `[code, nom]` et renvoie le
 * nom associé ou, à défaut, le code qui était cherché.
 *
 * @param dict Une liste de paires `[code, nom]` dans laquelle chercher
 * @param search Le code recherché
 * @returns Le nom correspondant au code recherché ou, à défaut, le code
 *          recherché
 */
function findOrDefaultToCode(dict: CodeAndName[], search: string): string {
  const found = dict.find((codeAndName) => codeAndName.code === search);
  if (found) {
    return found.name;
  }
  return search;
}

/**
 * Type de recherche de carte
 */
export enum SearchType {
  /** Recherche par code de carte */
  BY_CODE,

  /** Recherche par titre de carte */
  BY_TITLE,
}

/**
 * Type représentant les paramètres d'une recherche
 */
interface SearchParams {
  /** La valeur recherchée */
  searchString: string;

  /** Le type de recherche */
  searchType?: SearchType;
}

/**
 * Type représentant les options d'affichage de la carte
 */
interface EmbedOptions {
  /** Vrai pour une description complète, faux pour un affichage de la carte uniquement */
  extended: boolean;

  /** Vrai pour un affichage du dos de la carte */
  back: boolean;
}

/**
 * Vérifie si le titre français ou anglais de la carte contient la chaîne de
 * texte fournie.
 *
 * @param card La carte à analyser
 * @param searchString Le texte à chercher dans le titre
 * @returns Vrai si le titre de la carte contient le texte recherché
 */
function matchCard(card: ArkhamDBCard, searchString: string): boolean {
  return (
    card.name.toLowerCase().includes(searchString.toLowerCase()) ||
    card.real_name.toLowerCase().includes(searchString.toLowerCase())
  );
}

@Singleton
@OnlyInstantiableByContainer
/**
 * Service permettant différentes opérations en lien avec les cartes
 * du jeu.
 * Les données proviennent d'ArkhamDB (https://arkhamdb.com/) et sont
 * stockées localement dans un fichier JSON pour limiter les appels à l'API
 * et pouvoir effectuer des recherches.
 */
export class CardService extends BaseService {
  /** Etiquette utilisée pour les logs de ce service */
  private static LOG_LABEL = "CardService";

  /** Expression régulière permettant de détecter un code de carte */
  public static CARD_CODE_REGEX = /(\d{5})(b?)$/;

  /** Liste des cartes */
  private frenchCards!: DownloadableGlobalResource<ArkhamDBCard[]>;

  /** Liste des Taboos */
  private taboos!: DownloadableGlobalResource<ArkhamDBTaboo[]>;

  /** Liste des packs de cartes */
  private packs!: DownloadableGlobalResource<CodeAndName[]>;

  /** Liste des factions */
  private factions!: GlobalResource<CodeAndName[]>;

  /** Liste des types de carte */
  private types!: GlobalResource<CodeAndName[]>;

  @Inject private formatService!: FormatService;
  @Inject private logger!: LoggerService;
  @Inject private resources!: ResourcesService;

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);

    const resourceParams = {
      client,
      logger: this.logger,
      logLabel: CardService.LOG_LABEL,
      resourcesService: this.resources,
    };

    this.frenchCards = new DownloadableGlobalResource({
      ...resourceParams,
      filename: "cards.fr.json",
      url: "https://fr.arkhamdb.com/api/public/cards/?encounter=true",
    });
    this.taboos = new DownloadableGlobalResource({
      ...resourceParams,
      filename: "taboos.json",
      url: "https://fr.arkhamdb.com/api/public/taboos",
    });
    this.packs = new DownloadableGlobalResource({
      ...resourceParams,
      filename: "packs.json",
      url: "https://fr.arkhamdb.com/api/public/packs/",
    });
    this.factions = new GlobalResource({
      ...resourceParams,
      filename: "factions.json",
    });
    this.types = new GlobalResource({
      ...resourceParams,
      filename: "types.json",
    });
  }

  /**
   * Renvoie la liste des cartes.
   *
   * @returns La liste des cartes
   */
  private getFrenchCards(): ArkhamDBCard[] {
    return this.frenchCards.get() || [];
  }

  /**
   * Renvoie la liste des taboos.
   *
   * @returns La liste des taboos
   */
  private getTaboos(): Taboo[] {
    const allTaboos = this.taboos.get() || [];
    if (allTaboos.length > 0) {
      const latestTaboo = allTaboos[0];
      return JSON.parse(latestTaboo.cards) as Taboo[];
    } else {
      return [];
    }
  }

  /**
   * Renvoie la liste des packs.
   *
   * @returns La liste des packs
   */
  private getPacks(): CodeAndName[] {
    return this.packs.get() || [];
  }

  /**
   * Renvoie la liste des factions.
   *
   * @returns La liste des factions
   */
  private getFactions(): CodeAndName[] {
    return this.factions.get() || [];
  }

  /**
   * Renvoie la liste des types de carte.
   *
   * @returns La liste des types de carte
   */
  private getTypes(): CodeAndName[] {
    return this.types.get() || [];
  }

  /**
   * Raffraîchit les données en téléchargeant les ressources téléchargeables.
   *
   * @returns Une promesse résolue une fois les téléchargements réalisés
   */
  public async refreshData(): Promise<void> {
    await Promise.all([
      this.frenchCards.download(),
      this.packs.download(),
      this.taboos.download(),
    ]);
  }

  /**
   * Renvoie le nom français d'une carte à partir de son nom anglais
   * (correspondance exacte).
   *
   * @param englishName Nom anglais de la carte
   * @returns Le nom français de la carte si trouvé
   */
  public getFrenchCardName(englishName: string): string | undefined {
    const foundCard = this.getFrenchCards().find(
      (card) =>
        card.real_name.toLocaleLowerCase() === englishName.toLocaleLowerCase()
    );
    if (foundCard && foundCard.name !== foundCard.real_name)
      return foundCard.name;
    return undefined;
  }

  /**
   * Renvoie le nom angalis d'une carte à partir de son nom français
   * (correspondance exacte).
   *
   * @param frenchName Nom français de la carte
   * @returns Le nom anglais de la carte si trouvé
   */
  public getEnglishCardName(frenchName: string): string | undefined {
    const foundCard = this.getFrenchCards().find(
      (card) => card.name.toLocaleLowerCase() === frenchName.toLocaleLowerCase()
    );
    if (foundCard && foundCard.real_name !== foundCard.name)
      return foundCard.real_name;
    return undefined;
  }

  /**
   * Recherche l'ensemble des cartes répondant aux paramètres de recherche
   * fournis.
   *
   * @param searchParams Les paramètres de la recherche
   * @returns Toutes les cartes correspondant à la recherche
   */
  public getCards({
    searchString,
    searchType = SearchType.BY_TITLE,
  }: SearchParams): ArkhamDBCard[] {
    if (searchType === SearchType.BY_CODE) {
      return this.getFrenchCards().filter((card) => card.code === searchString);
    }

    return this.getFrenchCards()
      .filter((card) => card.pack_code !== "rcore")
      .filter((card) => matchCard(card, searchString));
  }

  /**
   * Renvoie l'ensemble de codes de cartes joueur (excluant dont les cartes
   * Mythe).
   *
   * @returns Tous les codes de cartes joueur
   */
  public getAllPlayerCardCodes(): string[] {
    return this.getFrenchCards()
      .filter((card) => card.faction_code !== "mythos")
      .filter((card) => card.encounter_code === undefined)
      .filter((card) => card.pack_code !== "rcore")
      .map((card) => card.code);
  }

  /**
   * Vérifie si une carte a un dos.
   *
   * @param card La carte
   * @returns Vrai si la carte a un dos
   */
  public hasBack(card: ArkhamDBCard): boolean {
    return !!card.back_text || !!card.backimagesrc;
  }

  /**
   * Créé un encart Discord permettant d'afficher une carte selon les options
   * d'affichage précisées.
   *
   * @param card La carte à afficher
   * @param embedOptions Les options d'affichage
   * @returns Un encart Discord pour l'affichage de la carte
   */
  public async createEmbeds(
    card: ArkhamDBCard,
    embedOptions: EmbedOptions
  ): Promise<Discord.EmbedBuilder[]> {
    const embeds: Discord.EmbedBuilder[] = [];

    const mainEmbed = new Discord.EmbedBuilder();
    this.decorateEmbedForCard(mainEmbed, card);

    const cardFaction = findOrDefaultToCode(
      this.getFactions(),
      card.faction_code
    );
    const cardFaction2 = card.faction2_code
      ? findOrDefaultToCode(this.getFactions(), card.faction2_code)
      : undefined;
    const cardFaction3 = card.faction3_code
      ? findOrDefaultToCode(this.getFactions(), card.faction3_code)
      : undefined;

    const factions = [cardFaction, cardFaction2, cardFaction3]
      .filter((faction) => faction !== undefined)
      .join(" / ");

    const cardType = findOrDefaultToCode(this.getTypes(), card.type_code);

    const isMulticlass = !!card.faction2_code;
    if (!["neutral", "mythos"].includes(card.faction_code) && !isMulticlass) {
      mainEmbed.setAuthor({
        name: `${cardType} ${factions}`,
        iconURL: `https://arkhamdb.com/bundles/app/images/factions/${card.faction_code}.png`,
      });
    } else {
      mainEmbed.setAuthor({ name: `${cardType} ${factions}` });
    }

    const maybeCardImageLink = await this.getCardImageLink(
      card,
      embedOptions.back
    );
    if (maybeCardImageLink) {
      mainEmbed.setImage(maybeCardImageLink);
    }

    const cardText = embedOptions.back ? card.back_text : card.text;

    if (embedOptions.extended || !maybeCardImageLink) {
      if (cardText) {
        mainEmbed.setDescription(this.formatService.format(cardText));
      }

      if (!embedOptions.back) {
        if (card.xp) {
          mainEmbed.addFields({
            name: "Niveau",
            value: card.xp.toString(),
            inline: true,
          });
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
          mainEmbed.addFields({
            name: "Icônes",
            value: icons !== "" ? this.formatService.format(icons) : "-",
            inline: true,
          });
        }

        if (card.cost) {
          mainEmbed.addFields({
            name: "Coût",
            value: card.cost.toString(),
            inline: true,
          });
        }

        if (card.slot) {
          let splitString = ". ";
          if (card.slot.includes("–")) {
            // Cas des cartes en français. Attention ce n'est pas le tiret du 6.
            // – et non -
            splitString = " – ";
          }

          const slotIcons = card.slot
            .split(splitString)
            .map((slotName) =>
              this.formatService.format(`[${slotName.toLowerCase()}]`)
            );

          mainEmbed.addFields({
            name: "Emplacement",
            value: slotIcons.join(" "),
            inline: true,
          });
        }

        if (card.health !== undefined || card.sanity !== undefined) {
          const healthAndSanity = `${
            card.health !== undefined ? card.health : "-"
          }[damage] ${card.sanity !== undefined ? card.sanity : "-"}[horror]`;

          mainEmbed.addFields({
            name: "Vie & santé mentale",
            value: this.formatService.format(healthAndSanity),
            inline: true,
          });
        }

        const maybePack = this.getPacks().find(
          (pack) => pack.code == card.pack_code
        );
        if (maybePack) {
          mainEmbed.addFields({ name: "Pack", value: maybePack.name });
        }

        mainEmbed.addFields({ name: "Nom anglais", value: card.real_name });
      }
    }

    const maybeTaboo = this.getTaboos().find(
      (taboo) => taboo.code === card.code
    );
    if (maybeTaboo) {
      const tabooText = [];
      if (maybeTaboo.xp) {
        tabooText.push(`XP: ${maybeTaboo.xp}`);
      }
      if (maybeTaboo.text) {
        tabooText.push(this.formatService.format(maybeTaboo.text));
      }
      mainEmbed.addFields({ name: "Taboo", value: tabooText.join("\n") });
    }

    const cardFAQs = await this.getCardFAQ(card);

    const footerParts = [];
    if (!embedOptions.back && this.hasBack(card)) {
      footerParts.push("Cette carte a un dos.");
    }
    if (cardFAQs.length > 0) {
      footerParts.push("Cette carte a une entrée dans la FAQ.");
    }

    if (footerParts.length > 0) {
      mainEmbed.setFooter({ text: footerParts.join(" ") });
    }

    embeds.push(mainEmbed);

    if (card.customization_text) {
      const customizableSheetEmbed = new Discord.EmbedBuilder();
      customizableSheetEmbed.setTitle("Personnalisations");
      customizableSheetEmbed.setColor(CLASS_COLORS[card.faction_code]);
      customizableSheetEmbed.setDescription(
        this.formatService.format(card.customization_text)
      );
      embeds.push(customizableSheetEmbed);
    }

    return embeds;
  }

  /**
   * Créé un encart Discord pour l'affiche des entrées de FAQ d'une carte.
   *
   * @param card La carte concernée
   * @param faqEntries Les entrées de FAQ
   * @returns Un encart présentant les entrées de FAQ pour la carte
   */
  public createFaqEmbed(
    card: ArkhamDBCard,
    faqEntries: CardFAQEntry[]
  ): Discord.EmbedBuilder {
    const embed = new Discord.EmbedBuilder();
    this.decorateEmbedForCard(embed, card);
    embed.setAuthor({ name: "FAQ" });

    const fullDescription = faqEntries.map((entry) => entry.text).join("\n\n");
    const withIcons = this.formatService.replaceIcons(fullDescription);
    if (withIcons.length <= 4096) {
      embed.setDescription(withIcons);
    } else {
      embed.setDescription(withIcons.slice(0, 4093) + "...");
      embed.setFooter({
        text: "Entrée de FAQ tronquée, suivre le lien pour la FAQ complète.",
      });
    }

    return embed;
  }

  /**
   * Personnalise un encart concernant une carte en positionnant le titre,
   * l'URL et la couleur.
   *
   * @param embed L'encart à personnaliser
   * @param card La carte concerné
   */
  private decorateEmbedForCard(
    embed: Discord.EmbedBuilder,
    card: ArkhamDBCard
  ): void {
    embed.setTitle(card.name);
    embed.setURL(`https://fr.arkhamdb.com/card/${card.code}`);

    const isMulticlass = !!card.faction2_code;
    embed.setColor(
      isMulticlass ? CLASS_COLORS.multiclass : CLASS_COLORS[card.faction_code]
    );
  }

  /**
   * Renvoie un lien vers une image de la carte ou de son dos. Cette fonction
   * va d'abord essayer de trouver un lien vers une image en français puis se
   * rabattre sur un lien vers une image en anglais.
   *
   * @param card La carte dont on cherche l'image
   * @param back Vrai si on souhaite le dos de la carte
   * @returns Une promesse résolue avec le lien vers l'image s'il a été trouvé
   */
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

  /**
   * Renvoie un lien vers une image en français de la carte si disponible. Le
   * lien est construit grâce au code de la carte et cette fonction fait
   * ensuite une requête HEAD sur ce lien pour vérifier si l'image existe. Si
   * ce n'est pas le cas, cette fonction sera résolue avec `undefined`.
   *
   * @param card La carte dont on cherche l'image
   * @param back Vrai si on souhaite le dos de la carte
   * @returns Une promesse résolue avec le lien vers l'image si elle est disponible
   */
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

  /**
   * Renvoie un lien vers une image en anglais de la carte si disponible. Le
   * lien est construit grâce au code de la carte et cette fonction fait
   * ensuite une requête HEAD sur ce lien pour vérifier si l'image existe. Si
   * ce n'est pas le cas, cette fonction sera résolue avec `undefined`.
   *
   * @param card La carte dont on cherche l'image
   * @param back Vrai si on souhaite le dos de la carte
   * @returns Une promesse résolue avec le lien vers l'image si elle est disponible
   */
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

  /**
   * Récupère la liste des entrées de FAQ pour la carte précisée. La liste retournée est
   * vide s'il n'y a pas d'entrées de FAQ pour cette carte.
   *
   * @param card La carte concernée
   * @returns Une liste d'entrées de FAQ
   */
  public async getCardFAQ(card: ArkhamDBCard): Promise<CardFAQEntry[]> {
    // TODO Mettre la réponse en cache pour limiter les appels à l'API
    //      et vide le cache à la commande refresh.
    try {
      const response = await axios.get<CardFAQEntry[]>(
        `https://fr.arkhamdb.com/api/public/faq/${card.code}`
      );
      return response.data;
    } catch (_error) {
      return [];
    }
  }
}

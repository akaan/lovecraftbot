import axios from "axios";
import * as Discord from "discord.js";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { ArkhamDBCard, CardService, SearchType } from "./CardService";
import { EmojiService } from "./EmojiService";
import { LoggerService } from "./LoggerService";

/**
 * Type représentant un emplacement dans un deck.
 * La clé est le code de la carte tandis que la valeur est le nombre de
 * copies de cette carte dans le deck.
 */
type Slots = { [cardCode: string]: number };

/**
 * Type représentant un deck sur ArkhamDB
 */
interface ArkhamDBDeck {
  /** Identifiant unique du deck */
  id: number;

  /** Nom du deck */
  name: string;

  /** Code de l'investigateur */
  investigator_code: string;

  /** Nom de l'investigateur */
  investigator_name: string;

  /** Contenu du deck */
  slots: Slots;

  /** Cartes mises de côtés */
  sideSlots: Slots | []; // https://github.com/Kamalisk/arkhamdb/issues/434

  /** Cartes non comptées dans la taille limite du deck */
  ignoreDeckLimitSlots: Slots;
}

/** Type générique pour ce qui contient une quantité */
interface WithQuantity {
  quantity: number;
}

/**
 * Type pour une carte dans un deck : c'est une carte avec un attribut
 * de quantité en plus
 */
type CardInDeck = ArkhamDBCard & WithQuantity;

/**
 * Représente une catégorie de carte dans la description d'un deck.
 */
interface DeckCategory {
  /** Titre de la catégorie */
  title: string;

  /** Filtre permettant de sélectionner les cartes appartenant à cette catégorie */
  filter: (card: CardInDeck) => boolean;

  /** Sous-catégories éventuelles de cette catégorie */
  subcategories?: DeckCategory[];
}

/**
 * Ensemble des catégories de cartes dans un deck pour gérer son affichage.
 */
const DECK_CATEGORIES: DeckCategory[] = [
  {
    title: "Soutiens",
    filter: (card: CardInDeck) => card.type_code === "asset" && !card.permanent,
    subcategories: [
      { title: "Main", filter: (card: CardInDeck) => card.slot === "Main" },
      {
        title: "Main x2",
        filter: (card: CardInDeck) => card.slot === "Main x2",
      },
      {
        title: "Accessoire",
        filter: (card: CardInDeck) => card.slot === "Accessoire",
      },
      { title: "Corps", filter: (card: CardInDeck) => card.slot === "Corps" },
      { title: "Allié", filter: (card: CardInDeck) => card.slot === "Allié" },
      { title: "Arcane", filter: (card: CardInDeck) => card.slot === "Arcane" },
      {
        title: "Arcane x2",
        filter: (card: CardInDeck) => card.slot === "Arcane x2",
      },
      { title: "Tarot", filter: (card: CardInDeck) => card.slot === "Tarot" },
      {
        title: "Autre",
        filter: (card: CardInDeck) =>
          typeof card.slot === "undefined" ||
          ![
            "Main",
            "Main x2",
            "Accessoire",
            "Corps",
            "Allié",
            "Arcane",
            "Arcane x2",
            "Tarot",
          ].includes(card.slot),
      },
    ],
  },
  {
    title: "Permanent",
    filter: (card: CardInDeck) => card.permanent,
  },
  {
    title: "Evénements",
    filter: (card: CardInDeck) => card.type_code === "event" && !card.permanent,
  },
  {
    title: "Compétences",
    filter: (card: CardInDeck) => card.type_code === "skill" && !card.permanent,
  },
  {
    title: "Traîtrises",
    filter: (card: CardInDeck) =>
      card.type_code === "treachery" && !card.permanent,
  },
  {
    title: "Ennemis",
    filter: (card: CardInDeck) => card.type_code === "enemy" && !card.permanent,
  },
];

/** Dictionnaire des icônes de classe */
const CLASS_ICONS: { [faction: string]: string } = {
  guardian: "ClassGuardian",
  seeker: "ClassSeeker",
  rogue: "ClassRogue",
  mystic: "ClassMystic",
  survivor: "ClassSurvivor",
};

/**
 * Fonction permettant le tri des cartes par ordre alphabétique de titre.
 *
 * @param c1 Première carte
 * @param c2 Seconde carte
 * @returns -1, 0 ou 1 selon résultat de la comparaison
 */
const byCardName = (c1: CardInDeck, c2: CardInDeck): number => {
  if (c1.name === c2.name) {
    return 0;
  }
  if (c1.name > c2.name) {
    return 1;
  }
  return -1;
};

@Singleton
@OnlyInstantiableByContainer
/**
 * Service permettant de rechercher des decks (non publiés) sur ArkhamDB
 * et de générer un affichage sous forme d'encart Discord de ces decks.
 */
export class DeckService extends BaseService {
  /** Etiquette utilisée pour les logs de ce service */
  private static LOG_LABEL = "DeckService";

  @Inject private cardService!: CardService;
  @Inject private emojiService!: EmojiService;
  @Inject private logger!: LoggerService;

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);
  }

  /**
   * Récupére sur ArkhamDB un deck à partir de son identifiant.
   *
   * @param deckId L'identifiant du deck
   * @returns Le deck s'il a été trouvé
   */
  public async getDeck(deckId: string): Promise<ArkhamDBDeck | undefined> {
    try {
      const response = await axios.get<ArkhamDBDeck>(
        `https://arkhamdb.com/api/public/deck/${deckId}`,
        { maxRedirects: 0 }
      );
      if (response.status === 200) {
        return response.data;
      }
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response && error.request) {
        this.logger.error(
          DeckService.LOG_LABEL,
          "Erreur à la récupération du deck",
          { error }
        );
      }
    }
  }

  /**
   * Créé un encart Discord d'affichage du deck fourni.
   *
   * @param deck Le deck à afficher
   * @returns Un encaert Discord affichant le deck
   */
  public createEmbed(deck: ArkhamDBDeck): Discord.EmbedBuilder {
    const embed = new Discord.EmbedBuilder();
    embed.setTitle(deck.name);
    embed.setURL(`https://fr.arkhamdb.com/deck/view/${deck.id}`);

    const cardsInDeck = this.addCardData(deck.slots);

    let desc = deck.investigator_name;

    DECK_CATEGORIES.forEach(({ title, filter, subcategories }) => {
      const cardsInCategory = cardsInDeck.filter(filter).sort(byCardName);
      if (cardsInCategory.length > 0) {
        const numberOfCard = cardsInCategory.reduce(
          (sum, card) => sum + card.quantity,
          0
        );
        desc += `\n\n**${title}** (${numberOfCard})`;
        if (subcategories) {
          subcategories.forEach((subcategory) => {
            const cardsInSubcategory = cardsInCategory.filter(
              subcategory.filter
            );
            if (cardsInSubcategory.length > 0) {
              desc += `\n__${subcategory.title}__\n`;
              desc += cardsInSubcategory
                .map((card) => this.formatCard(card))
                .join("\n");
            }
          });
        } else {
          desc += "\n";
          desc += cardsInCategory
            .map((card) => this.formatCard(card))
            .join("\n");
        }
      }
    });

    if (!Array.isArray(deck.sideSlots)) {
      desc += "\n\n**Cartes de côté**\n";
      desc += this.addCardData(deck.sideSlots)
        .map((card) => this.formatCard(card))
        .join("\n");
    }

    embed.setDescription(desc);

    return embed;
  }

  /**
   * Transforme une description d'emplacements dans un deck (i.e. code et
   * quantité) par une liste de cartes (description complète) et les
   * quantités associées. Cette méthode fait appelle au service
   * {@link CardService} qui gère la base de données des cartes.
   *
   * @param slots Les emplacements de deck
   * @returns Une liste de cartes avec les quantités associées
   */
  private addCardData(slots: Slots): CardInDeck[] {
    const cardsInDeck: CardInDeck[] = [];

    Object.keys(slots).forEach((cardCode) => {
      const card = this.cardService.getCards({
        searchString: cardCode,
        searchType: SearchType.BY_CODE,
      });
      if (card.length > 0) {
        cardsInDeck.push({ ...card[0], quantity: slots[cardCode] });
      }
    });

    return cardsInDeck;
  }

  /**
   * Formate l'affiche d'une ligne dans un deck, c'est-à-dire une carte.
   *
   * @param cardInDeck Une carte et sa quantité dans le deck
   * @returns Une ligne de deck : icône, titre de carte et quantité
   */
  private formatCard(cardInDeck: CardInDeck): string {
    const level = cardInDeck.xp || 0;
    const signature = typeof cardInDeck.xp === "undefined";

    const factions = [
      cardInDeck.faction_code,
      cardInDeck.faction2_code,
      cardInDeck.faction3_code,
    ].filter((faction) => faction !== undefined);

    const factionIcons = factions
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .map((faction) => CLASS_ICONS[faction!])
      .filter((faction) => faction !== undefined);

    const factionEmojis = factionIcons.map((icon) =>
      this.emojiService.getEmoji(icon)
    );

    return `${cardInDeck.quantity}x ${factionEmojis.join(" ")} [${
      cardInDeck.name
    }](https://fr.arkhamdb.com/card/${cardInDeck.code}) ${"•".repeat(level)}${
      signature ? " ★" : ""
    }`;
  }
}

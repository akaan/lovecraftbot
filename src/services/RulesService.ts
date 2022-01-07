import * as Discord from "discord.js";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { FormatService } from "./FormatService";
import { LoggerService } from "./LoggerService";
import { ResourcesService } from "./ResourcesService";

/**
 * Type représentant une ligne dans les règles.
 */
interface TableRow {
  row: Array<{ color?: string; text?: string }>;
}

/**
 * Type représentant un point de règle.
 */
export interface Rule {
  /** Identifiant du point de règle */
  id: string;

  /** Titre du point de règle */
  title: string;

  /** Texte du point de règle */
  text?: string;

  /** Tableau de présentation de ce poitn de règle */
  table: TableRow[];

  /** Sous-règles associées à ce point de règle */
  rules?: Rule[];
}

/**
 * Met à plat un ensemble de règles en remontant au premier niveau de hiérarchie
 * les sous-règles.
 *
 * @param rules L'ensemble des points de règles
 * @returns Ensemble de règles mis à plat
 */
function flattenRules(rules: Rule[]): Rule[] {
  return rules.reduce((flat, rule) => {
    if (rule.rules) {
      return [...flat, rule, ...flattenRules(rule.rules)];
    }
    return [...flat, rule];
  }, [] as Rule[]);
}

/**
 * Vérifie si la règle indiqué correspond à la recherche fourni sur la base de
 * son titre et de son texte.
 *
 * @param rule Le point de règle
 * @param searchString La recherche effectuée
 * @returns Vrai si le point de règles correspond à la recherche
 */
function matchRule(rule: Rule, searchString: string): boolean {
  return (
    rule.title.toLowerCase().includes(searchString.toLowerCase()) ||
    (!!rule.text &&
      rule.text.toLowerCase().includes(searchString.toLowerCase()))
  );
}

@Singleton
@OnlyInstantiableByContainer
/**
 * Service permettant la recherche et l'affichage de points de règles du jeu.
 * Les données proviennent du dépôt de code d'ArkhamCards.
 * @see https://github.com/zzorba/ArkhamCards/blob/master/assets/generated/rules_fr.json
 */
export class RulesService extends BaseService {
  /** Etiquette utilisée pour les logs de ce service */
  private static LOG_LABEL = "RulesService";

  /** L'ensemble des points de règle */
  private rules: Rule[] = [];

  @Inject private formatService!: FormatService;
  @Inject private logger!: LoggerService;
  @Inject private resources!: ResourcesService;

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);
    await this.loadRules();
  }

  /**
   * Recherche un point de règle dont le titre correspond au texte fourni s'il
   * n'y a bien qu'une seule règle avec ce titre.
   *
   * @param search Le texte recherché dans le titre
   * @returns Le point de règle correspondant au texte fourni s'il n'y en a bien
   *          qu'une seule
   */
  public getRule(search: string): Rule | undefined {
    const foundRules = this.rules.filter((rule) =>
      rule.title.toLowerCase().includes(search.toLowerCase())
    );
    if (foundRules.length > 0) {
      return foundRules[0];
    }
  }

  /**
   * Récupère l'ensemble des points de règles comprenant le texte recherché
   * dans leur titre ou leur corps.
   *
   * @param search Le texte recherché dans le titre ou les corps des règles
   * @returns L'ensemble des règles correspondant à la recherche
   */
  public getRules(search: string): Rule[] {
    return this.rules.filter((rule) => matchRule(rule, search));
  }

  /**
   * Créé les encarts Discord permettant d'afficher un point de règle et les
   * sous-règles associées.
   *
   * @param rule La règle à afficher
   * @returns Un ensemble d'encart Discord pour l'affichage de la règle et des
   *          sous-règles
   */
  public createEmbeds(rule: Rule): Discord.MessageEmbed[] {
    const mainEmbed = new Discord.MessageEmbed();
    const subEmbeds: Discord.MessageEmbed[] = [];
    mainEmbed.setAuthor(rule.title);

    if (rule.text) {
      const ruleText = this.deleteLinks(rule.text);
      mainEmbed.setDescription(this.formatService.format(ruleText));
    }

    if (rule.rules) {
      rule.rules.forEach((subRule) => {
        if (subRule.text) {
          const subRuleText = this.deleteLinks(subRule.text);
          const subEmbed = new Discord.MessageEmbed();
          subEmbed.setAuthor(subRule.title);
          subEmbed.setDescription(this.formatService.format(subRuleText));
          subEmbeds.push(subEmbed);
        }
        if (subRule.table) {
          const tableAsText = subRule.table
            .map(({ row }) => {
              if (row.length > 0) {
                return row[0].text ? row[0].text : "";
              }
              return "";
            })
            .join("\n");
          const tableEmbed = new Discord.MessageEmbed();
          tableEmbed.setAuthor(subRule.title);
          tableEmbed.setDescription(this.formatService.format(tableAsText));
          subEmbeds.push(tableEmbed);
        }
      });
    }

    return [mainEmbed, ...subEmbeds];
  }

  /**
   * Supprime les liens au format markdown dans le texte fourni et les remplace
   * par leur titre uniquement.
   *
   * @param text Le texte duquel supprimer les liens
   * @returns Un texte sans lien
   */
  private deleteLinks(text: string): string {
    const matches = text.match(/\[([^[]*)]\([^)]*\)/g);

    if (!matches || !matches[0]) {
      return text;
    }

    matches.forEach(() => {
      text = text.replace(/\[([^[]*)]\([^)]*\)/, "<b>$1</b>");
    });

    return text;
  }

  /**
   * Charge les points de règle stocké sur fichier.
   *
   * @returns Une promesse résolue une fois le chargement terminé
   */
  private async loadRules() {
    const rawData = await this.resources.readResource("rules_fr.json");
    if (rawData) {
      try {
        this.rules = flattenRules(JSON.parse(rawData) as Rule[]);
      } catch (error) {
        this.logger.error(
          RulesService.LOG_LABEL,
          `Erreur au chargement des règles`,
          { error }
        );
      }
    }
  }
}

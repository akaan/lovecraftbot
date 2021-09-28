import * as Discord from "discord.js";
import { Inject, OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";
import { FormatService } from "./FormatService";
import { LoggerService } from "./LoggerService";
import { ResourcesService } from "./ResourcesService";

interface TableRow {
  row: Array<{ color?: string; text?: string }>;
}

interface Rule {
  id: string;
  title: string;
  text?: string;
  table: TableRow[];
  rules?: Rule[];
}

function flattenRules(rules: Rule[]): Rule[] {
  return rules.reduce((flat, rule) => {
    if (rule.rules) {
      return [...flat, rule, ...flattenRules(rule.rules)];
    }
    return [...flat, rule];
  }, [] as Rule[]);
}

function matchRule(rule: Rule, searchString: string): boolean {
  return (
    rule.title.toLowerCase().includes(searchString.toLowerCase()) ||
    (!!rule.text &&
      rule.text.toLowerCase().includes(searchString.toLowerCase()))
  );
}

@Singleton
@OnlyInstantiableByContainer
export class RulesService extends BaseService {
  private rules: Rule[] = [];

  @Inject private formatService!: FormatService;
  @Inject private logger!: LoggerService;
  @Inject private resources!: ResourcesService;

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);
    await this.loadRules();
  }

  public getRule(search: string): Rule | undefined {
    const foundRules = this.rules.filter((rule) =>
      rule.title.toLowerCase().includes(search.toLowerCase())
    );
    if (foundRules.length > 0) {
      return foundRules[0];
    }
  }

  public searchRule(search: string): string[] | undefined {
    const foundRules = this.rules.filter((rule) => matchRule(rule, search));
    if (foundRules.length > 0) {
      return foundRules.map((found) => found.title);
    }
  }

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

  private async loadRules() {
    const rawData = await this.resources.readResource("rules_fr.json");
    if (rawData) {
      try {
        this.rules = flattenRules(JSON.parse(rawData) as Rule[]);
      } catch (err) {
        this.logger.error(err);
      }
    }
  }
}

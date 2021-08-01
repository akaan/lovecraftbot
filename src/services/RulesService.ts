import diacritics from "diacritics";
import * as Discord from "discord.js";
import Fuse from "fuse.js";
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

@Singleton
@OnlyInstantiableByContainer
export class RulesService extends BaseService {
  private rulesIndex: Fuse<Rule> = new Fuse<Rule>([]);

  @Inject formatService?: FormatService;
  @Inject logger?: LoggerService;
  @Inject resources?: ResourcesService;

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);
    await this.loadRules();
  }

  public getRule(search: string): Rule | undefined {
    const foundRules = this.rulesIndex.search(diacritics.remove(search));
    if (foundRules.length > 0) {
      return foundRules[0].item;
    }
  }

  public createEmbeds(rule: Rule): Discord.MessageEmbed[] {
    const mainEmbed = new Discord.MessageEmbed();
    const subEmbeds: Discord.MessageEmbed[] = [];
    mainEmbed.setAuthor(rule.title);

    if (rule.text) {
      const ruleText = this.deleteLinks(rule.text);
      if (this.formatService) {
        mainEmbed.setDescription(this.formatService.format(ruleText));
      } else {
        mainEmbed.setDescription(ruleText);
      }
    }

    if (rule.rules) {
      rule.rules.forEach((subRule) => {
        if (subRule.text) {
          const subRuleText = this.deleteLinks(subRule.text);
          const subEmbed = new Discord.MessageEmbed();
          subEmbed.setAuthor(subRule.title);
          if (this.formatService) {
            subEmbed.setDescription(this.formatService.format(subRuleText));
          } else {
            subEmbed.setDescription(subRuleText);
          }
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
          if (this.formatService) {
            tableEmbed.setDescription(this.formatService.format(tableAsText));
          } else {
            tableEmbed.setDescription(tableAsText);
          }
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
    if (!this.resources) {
      return;
    }

    const rawData = await this.resources.readResource("rules_fr.json");
    if (rawData) {
      try {
        const rules = JSON.parse(rawData) as Rule[];

        this.rulesIndex = new Fuse<Rule>(rules, {
          keys: ["title"],
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

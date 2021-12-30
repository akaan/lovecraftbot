import {
  CommandInteraction,
  Message,
  MessageActionRow,
  MessageSelectMenu,
  SelectMenuInteraction,
} from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import { ISlashCommand, ISlashCommandResult } from "../interfaces";
import { Rule, RulesService } from "../services/RulesService";

/*
 Le nombre maximum de points de règles à afficher pour éviter de dépasser
 la limite de l'API Discord
*/
const MAX_RULES = 25;

export class RuleCommand implements ISlashCommand {
  @Inject private rulesService!: RulesService;

  isAdmin = false;
  name = "regle";
  description = "Afficher un point de règle";
  options = [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "recherche",
      description: "Texte à chercher dans les titres de règles",
      required: true,
    },
  ];

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<ISlashCommandResult> {
    const search = commandInteraction.options.getString("recherche");
    if (search) {
      const matchingRules = this.rulesService.getRules(search);
      if (matchingRules.length > 0) {
        if (matchingRules.length === 1) {
          return this.sendRule(commandInteraction, matchingRules[0]);
        } else {
          if (commandInteraction.inGuild()) {
            return this.sendRuleChoices(commandInteraction, matchingRules);
          } else {
            await commandInteraction.reply(
              `Désolé mais ${matchingRules.length} règles correspondent à cette recherche et je ne sais pas encore te présenter un menu de sélection dans ce canal. Essaye d'être plus précis ou bien effectue cette recherche sur un serveur.`
            );
            return {
              message: `[RuleCommand] Demande de plusieurs règles hors serveur : pas possible`,
            };
          }
        }
      } else {
        await commandInteraction.reply(
          `Aucun titre de règle ne contient le terme "${search}"`
        );
        return {
          message: `[RuleCommand] Aucune règle ne correspondant à "${search}"`,
        };
      }
    } else {
      await commandInteraction.reply("Oops, il y a eu un problème");
      return {
        message: `[RuleCommand] Pas de texte recherché fourni`,
      };
    }
  }

  private async sendRule(
    interaction: CommandInteraction | SelectMenuInteraction,
    rule: Rule
  ): Promise<ISlashCommandResult> {
    const ruleEmbeds = this.rulesService.createEmbeds(rule);
    await interaction.reply({ embeds: ruleEmbeds });
    return { message: `[RuleCommand] Règle(s) envoyée(s)` };
  }

  private async sendRuleChoices(
    interaction: CommandInteraction,
    rules: Rule[]
  ): Promise<ISlashCommandResult> {
    const ruleChoices = rules
      .map((rule) => ({
        label: rule.title,
        value: rule.id,
      }))
      .slice(0, MAX_RULES);

    const menuComponent = new MessageActionRow().addComponents([
      new MessageSelectMenu()
        .setCustomId("ruleId")
        .setPlaceholder("Choisissez une règle à afficher")
        .addOptions(ruleChoices),
    ]);

    const menu = (await interaction.reply({
      content: `${rules.length} règles correspondent à la recherche.${
        rules.length > 25
          ? " Je vous proposent seulement les 25 premières, essayez d'affiner votre recherche."
          : ""
      }`,
      components: [menuComponent],
      ephemeral: true,
      fetchReply: true,
    })) as Message;

    const menuCollector = menu.createMessageComponentCollector({
      componentType: "SELECT_MENU",
    });

    const onSelect = async (selectMenuInteraction: SelectMenuInteraction) => {
      const ruleIdSelected = selectMenuInteraction.values[0];
      const ruleToSend = rules.find((r) => r.id === ruleIdSelected);
      if (ruleToSend) {
        await this.sendRule(selectMenuInteraction, ruleToSend);
      } else {
        await selectMenuInteraction.reply(`Oups, il y a eu un problème`);
      }
    };

    menuCollector.on("collect", onSelect);

    return { message: `[RuleCommand] Menu de sélection de règle envoyé` };
  }
}

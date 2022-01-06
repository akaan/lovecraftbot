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

import { createSelectMenuCollector } from "../discordHelpers";
import { IApplicationCommand, IApplicationCommandResult } from "../interfaces";
import { Rule, RulesService } from "../services/RulesService";

/*
 Le nombre maximum de points de règles à afficher pour éviter de dépasser
 la limite de l'API Discord
*/
const MAX_RULES = 25;

export class RuleCommand implements IApplicationCommand {
  @Inject private rulesService!: RulesService;

  isGuildCommand = false;
  name = "regle";
  description = "Afficher un point de règle";
  options = [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "recherche",
      description: "Texte à chercher dans les titres de règles",
      required: true,
    },
    {
      type: ApplicationCommandOptionTypes.BOOLEAN,
      name: "ephemere",
      description: "Si vrai, seul toi pourra voir la réponse",
      required: false,
    },
  ];

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    const search = commandInteraction.options.getString("recherche");
    const ephemeral =
      commandInteraction.options.getBoolean("ephemere") || false;

    if (search) {
      const matchingRules = this.rulesService.getRules(search);
      if (matchingRules.length > 0) {
        if (matchingRules.length === 1) {
          return this.sendRule(commandInteraction, matchingRules[0], {
            ephemeral,
          });
        } else {
          return this.sendRuleChoices(commandInteraction, matchingRules, {
            ephemeral,
          });
        }
      } else {
        await commandInteraction.reply(
          `Aucun titre de règle ne contient le terme "${search}"`
        );
        return {
          cmd: "RuleCommand",
          result: `Aucune règle ne correspondant à "${search}"`,
        };
      }
    } else {
      await commandInteraction.reply("Oops, il y a eu un problème");
      return {
        cmd: "RuleCommand",
        result: `Pas de texte recherché fourni`,
      };
    }
  }

  private async sendRule(
    interaction: CommandInteraction | SelectMenuInteraction,
    rule: Rule,
    options = { ephemeral: true }
  ): Promise<IApplicationCommandResult> {
    const ruleEmbeds = this.rulesService.createEmbeds(rule);
    await interaction.reply({
      embeds: ruleEmbeds,
      ephemeral: options.ephemeral,
    });
    return { cmd: "RuleCommand", result: `Règle(s) envoyée(s)` };
  }

  private async sendRuleChoices(
    interaction: CommandInteraction,
    rules: Rule[],
    options = { ephemeral: true }
  ): Promise<IApplicationCommandResult> {
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

    const menuCollector = await createSelectMenuCollector(menu, interaction);

    const onSelect = async (selectMenuInteraction: SelectMenuInteraction) => {
      const ruleIdSelected = selectMenuInteraction.values[0];
      const ruleToSend = rules.find((r) => r.id === ruleIdSelected);
      if (ruleToSend) {
        await this.sendRule(selectMenuInteraction, ruleToSend, options);
      } else {
        await selectMenuInteraction.reply(`Oups, il y a eu un problème`);
      }
      if (menuCollector) menuCollector.stop();
    };

    if (menuCollector) {
      menuCollector.on("collect", onSelect);
      return {
        cmd: "RuleCommand",
        result: `Menu de sélection de règle envoyé`,
      };
    } else {
      await interaction.editReply({
        content:
          "Oups, je ne sais pas te proposer un choix de règle dans ce canal.",
        components: [],
      });
      return {
        cmd: "RuleCommand",
        result: `Impossible d'envoyer un menu de sélection de règle`,
      };
    }
  }
}

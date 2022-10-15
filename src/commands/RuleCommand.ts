import {
  ActionRowBuilder,
  CommandInteraction,
  SelectMenuBuilder,
  SelectMenuInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { Inject } from "typescript-ioc";

import { createSelectMenuCollector, getEmbedSize } from "../discordHelpers";
import {
  ApplicationCommandAccess,
  IApplicationCommand,
  IApplicationCommandResult,
} from "../interfaces";
import { Rule, RulesService } from "../services/RulesService";
import { partition } from "../utils";

/*
 Le nombre maximum de points de règles à afficher pour éviter de dépasser
 la limite de l'API Discord
*/
const MAX_RULES = 25;

/** Commande d'affichaque de points de règle */
export class RuleCommand implements IApplicationCommand {
  @Inject private rulesService!: RulesService;

  commandAccess = ApplicationCommandAccess.GLOBAL;

  commandData = new SlashCommandBuilder()
    .setName("regle")
    .setDescription("Afficher un point de règle")
    .addStringOption((option) =>
      option
        .setName("recherche")
        .setDescription("Texte à chercher dans les titres de règles")
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("ephemere")
        .setDescription("Si vrai, seul toi pourra voir la réponse")
        .setRequired(false)
    );

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    if (!commandInteraction.isChatInputCommand()) {
      await commandInteraction.reply("Oups, y'a eu un problème");
      return { cmd: "RuleCommand", result: "Interaction hors chat" };
    }

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

  /**
   * Envoie le point de règle.
   *
   * @param interaction L'interaction déclenchée par la commande
   * @param rule Le point de règle à afficher
   * @param options Les options d'affichage
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async sendRule(
    interaction: CommandInteraction | SelectMenuInteraction,
    rule: Rule,
    options = { ephemeral: true }
  ): Promise<IApplicationCommandResult> {
    const ruleEmbeds = this.rulesService.createEmbeds(rule);
    const partitionOversized = partition(
      ruleEmbeds,
      (embed) => getEmbedSize(embed) < 3000
    );
    if (partitionOversized.fail.length > 0) {
      await interaction.reply({
        content: `Je ne peux pas afficher les règles suivantes qui sont trop grosses pour Discord: ${partitionOversized.fail
          .map((e) => e.data.author?.name)
          .join(", ")}`,
        embeds: partitionOversized.pass,
        ephemeral: options.ephemeral,
      });
    } else {
      await interaction.reply({
        embeds: partitionOversized.pass,
        ephemeral: options.ephemeral,
      });
    }
    return { cmd: "RuleCommand", result: `Règle(s) envoyée(s)` };
  }

  /**
   * Envoie à l'utilisateur un menu de sélection parmi plusieurs point de règle
   * remontés par la recherche.
   *
   * @param interaction L'interaction déclenchée par la commande
   * @param rules Les règles trouvées parmi lesquelles choisir
   * @param options Les options d'affichage
   * @returns Une promesse résolue avec le résultat de la commande
   */
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

    const menuComponent =
      new ActionRowBuilder<SelectMenuBuilder>().addComponents(
        new SelectMenuBuilder()
          .setCustomId("ruledId")
          .setPlaceholder("Choisissez une règle à afficher")
          .addOptions(ruleChoices)
      );

    const menu = await interaction.reply({
      content: `${rules.length} règles correspondent à la recherche.${
        rules.length > 25
          ? " Je vous proposent seulement les 25 premières, essayez d'affiner votre recherche."
          : ""
      }`,
      components: [menuComponent],
      ephemeral: true,
      fetchReply: true,
    });

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

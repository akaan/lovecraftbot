//import * as Discord from "discord.js";
import { CommandInteraction } from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import { ISlashCommand, ISlashCommandResult } from "../interfaces";
import { RulesService } from "../services/RulesService";
import { DiscordMenu } from "../utils/DiscordMenu";

export class RuleCommand implements ISlashCommand {
  @Inject private rulesService!: RulesService;

  isAdmin = false;
  name = "regle";
  description = "Affiche la règle (correspondance exacte)";
  options = [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "nom",
      description: "Nom de la règle cherchée",
      required: true,
    },
  ];

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<ISlashCommandResult> {
    const ruleName = commandInteraction.options.getString("nom");
    if (ruleName) {
      const maybeRule = this.rulesService.getRule(ruleName);
      if (maybeRule) {
        const responses = this.rulesService.createEmbeds(maybeRule);
        if (responses.length > 1) {
          const menu = new DiscordMenu(responses);
          await menu.replyToInteraction(commandInteraction);
        } else {
          await commandInteraction.reply({ embeds: [responses[0]] });
        }
        return { message: `[RuleCommand] Règle envoyée` };
      } else {
        await commandInteraction.reply(
          `Désolé, je ne trouve pas de règle correspondante`
        );
        return {
          message: `[RuleCommand] Pas de règle trouvée pour "${ruleName}"`,
        };
      }
    } else {
      return { message: `[RuleCommand] Nom de règle non fourni` };
    }
  }
}

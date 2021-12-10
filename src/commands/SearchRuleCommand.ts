import { CommandInteraction } from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import { ISlashCommand, ISlashCommandResult } from "../interfaces";
import { RulesService } from "../services/RulesService";

/*
 Le nombre maximum de points de règles à afficher pour éviter de dépasser
 la limite de l'API Discord (2000 caractères pour un message)
*/
const MAX_RULES = 20;

export class SearchRuleCommand implements ISlashCommand {
  @Inject private rulesService!: RulesService;

  isAdmin = false;
  name = "s";
  description = "Affiche la liste des points de règles contenant ces termes";
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
      const ruleTitles = this.rulesService.searchRule(search);
      if (ruleTitles) {
        let text: string;
        if (ruleTitles.length > MAX_RULES) {
          text = `Beaucoup de points de règles correspondent à "${search}"". Voici les ${MAX_RULES} premiers:\n`;
          text += ruleTitles
            .slice(0, MAX_RULES)
            .map((title) => `- ${title}`)
            .join("\n");
          text += "- ...";
        } else {
          text = `Voici la liste des points de règles contenant les termes "${search}":\n`;
          text += ruleTitles.map((title) => `- ${title}`).join("\n");
        }

        await commandInteraction.reply(text);

        return {
          message: `[SearchRuleCommand] Liste des règles envoyée`,
        };
      } else {
        await commandInteraction.reply(
          "désolé, je ne trouve pas de règles correspondantes"
        );
        return {
          message: `[SearchRuleCommand] Pas de règles trouvées pour ${search}`,
        };
      }
    } else {
      return { message: `[SearchRuleCommand] Texte recherché non fourni` };
    }
  }
}

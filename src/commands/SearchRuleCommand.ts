import { Inject } from "typescript-ioc";

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { RulesService } from "../services/RulesService";

/*
 Le nombre maximum de points de règles à afficher pour éviter de dépasser
 la limite de l'API Discord (2000 caractères pour un message)
*/
const MAX_RULES = 20;

export class SearchRuleCommand implements ICommand {
  aliases = ["s"];
  help = "Affiche la liste des points de règles contenant ces termes";

  @Inject private rulesService!: RulesService;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message, args } = cmdArgs;
    const ruleTitles = this.rulesService.searchRule(args);
    if (ruleTitles) {
      let text: string;
      if (ruleTitles.length > MAX_RULES) {
        text = `Beaucoup de points de règles correspondent à "${args}"". Voici les ${MAX_RULES} premiers:\n`;
        text += ruleTitles
          .slice(0, MAX_RULES)
          .map((title) => `- ${title}`)
          .join("\n");
        text += "- ...";
      } else {
        text = `Voici la liste des points de règles contenant les termes "${args}":\n`;
        text += ruleTitles.map((title) => `- ${title}`).join("\n");
      }

      await message.reply(text);

      return {
        resultString: `[SearchRuleCommand] Liste des règles envoyée`,
      };
    } else {
      await message.reply("désolé, je ne trouve pas de règles correspondantes");
      return {
        resultString: `[SearchRuleCommand] Pas de règles trouvées pour ${args}`,
      };
    }
  }
}

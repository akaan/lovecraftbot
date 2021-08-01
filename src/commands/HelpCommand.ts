import { Inject } from "typescript-ioc";

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { HelpService } from "../services/HelpService";
import { EnvService } from "../services/EnvService";

export class HelpCommand implements ICommand {
  aliases = ["help", "aide"];
  help = "Affiche ce message !";

  @Inject private envService?: EnvService;
  @Inject private helpService?: HelpService;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    if (!this.envService) {
      return { resultString: `[HelpCommand] EnvService absent` };
    }

    if (!this.helpService) {
      return { resultString: `[HelpCommand] HelpService absent` };
    }

    const commandPrefix = this.envService.commandPrefix;

    const { message } = cmdArgs;
    await message.author.send(`
**__Toutes les commandes__**
${this.helpService.allHelp
  .map(({ aliases, help }) => {
    return `__${aliases
      .map((x) => `\`${commandPrefix}${x}\``)
      .join(", ")}__\n${help}\n`;
  })
  .join("\n")}
`);

    return { resultString: "[HelpCommand] Aide envoyée" };
  }
}

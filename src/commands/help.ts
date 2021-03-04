import { Inject } from "typescript-ioc";

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { HelpService } from "../services/help";
import { EnvService } from "../services/env";

export class HelpCommand implements ICommand {
  help = "Display this message!";
  aliases = ["help"];

  @Inject private envService: EnvService;
  @Inject private helpService: HelpService;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message } = cmdArgs;
    await message.author.send(`
**__Toutes les commandes__**
${this.helpService.allHelp
  .map(({ aliases, help }) => {
    return `__${aliases
      .map((x) => `\`${this.envService.commandPrefix}${x}\``)
      .join(", ")}__\n${help}\n`;
  })
  .join("\n")}
`);

    return { resultString: "helped" };
  }
}

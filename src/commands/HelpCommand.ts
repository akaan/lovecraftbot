import { Inject } from "typescript-ioc";

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { HelpService } from "../services/HelpService";
import { EnvService } from "../services/EnvService";
import { EmbedFieldData, MessageEmbed } from "discord.js";

export class HelpCommand implements ICommand {
  aliases = ["help", "aide"];
  help = "Affiche ce message !";

  @Inject private envService!: EnvService;
  @Inject private helpService!: HelpService;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const commandPrefix = this.envService.commandPrefix;

    const { message } = cmdArgs;

    const embed = new MessageEmbed();
    embed.setTitle(`Toutes les commandes`);
    const fieldsData: EmbedFieldData[] = this.helpService.allHelp.map(
      ({ aliases, help }) => {
        return {
          name: aliases.map((alias) => `${commandPrefix}${alias}`).join(", "),
          value: help,
        };
      }
    );
    embed.addFields(fieldsData);
    await message.author.send(embed);

    return { resultString: "[HelpCommand] Aide envoyée" };
  }
}

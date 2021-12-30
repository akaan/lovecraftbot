import { EmbedFieldData, MessageEmbed } from "discord.js";
import { Inject } from "typescript-ioc";

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { EnvService } from "../services/EnvService";
import { HelpService } from "../services/HelpService";
import { RoleService } from "../services/RoleService";

export class HelpCommand implements ICommand {
  aliases = ["help", "aide"];
  help = "Affiche ce message !";

  @Inject private envService!: EnvService;
  @Inject private helpService!: HelpService;
  @Inject private roleService!: RoleService;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const commandPrefix = this.envService.commandPrefix;

    const { message } = cmdArgs;

    const botAdminRole = this.envService.botAdminRoleName;
    const isAdmin =
      botAdminRole !== undefined &&
      this.roleService.isMessageFromRole(message, botAdminRole);

    const embed = new MessageEmbed();
    embed.setTitle(`Toutes les commandes`);
    const helpTexts = isAdmin
      ? this.helpService.allHelp
      : this.helpService.allHelp.filter(
          (helpText) => helpText.admin === undefined || helpText.admin === false
        );
    const fieldsData: EmbedFieldData[] = helpTexts.map(
      ({ aliases, help, admin }) => {
        return {
          name: aliases
            .map(
              (alias) => `${admin ? "[ADMIN] " : ""}${commandPrefix}${alias}`
            )
            .join(", "),
          value: help,
        };
      }
    );
    embed.addFields(fieldsData);
    await message.author.send({ embeds: [embed] });

    return { resultString: "[HelpCommand] Aide envoyée" };
  }
}

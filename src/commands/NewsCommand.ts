import {
  ChannelType,
  CommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { Inject } from "typescript-ioc";

import {
  ApplicationCommandAccess,
  IApplicationCommand,
  IApplicationCommandResult,
} from "../interfaces";
import { GuildConfigurationService } from "../services/GuildConfigurationService";

/**
 * Commande d'administration pour l'envoi des articles de news sur le jeu
 */
export class NewsCommand implements IApplicationCommand {
  @Inject private guildConfigurationService!: GuildConfigurationService;

  commandAccess = ApplicationCommandAccess.ADMIN;

  commandData = new SlashCommandBuilder()
    .setName("news")
    .setDescription("Administration de l'envoi des news")
    .addSubcommand((subCommand) =>
      subCommand
        .setName("canal")
        .setDescription("Définit le canal d'envoi des news")
        .addChannelOption((option) =>
          option
            .setName("canal")
            .setDescription("Le canal sur lequel envoyer les news")
            .setRequired(true)
        )
    );

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    if (!commandInteraction.isChatInputCommand()) {
      await commandInteraction.reply("Oups, y'a eu un problème");
      return { cmd: "NewsCommand", result: "Interaction hors chat" };
    }

    if (commandInteraction.options.getSubcommand() === "canal") {
      if (commandInteraction.guild) {
        const channel = commandInteraction.options.getChannel("canal");
        if (channel && channel.type === ChannelType.GuildText) {
          await this.guildConfigurationService.setConfig(
            commandInteraction.guild,
            "newsChannelId",
            channel.id
          );
          await commandInteraction.reply({
            content: `C'est fait ! Les news seront envoyées sur le canal ${channel.name}`,
            ephemeral: true,
          });
          return {
            cmd: "NewsCommand",
            result: "Canal d'envoi des news positionné",
            channelName: channel.name,
          };
        } else {
          await commandInteraction.reply({
            content: `Désolé, mais je n'ai pas trouvé ce canal ou son type ne convient pas`,
            ephemeral: true,
          });
          return {
            cmd: "NewsCommand",
            result: "Impossible de positionner le canal d'envoi des news",
            channel: channel,
          };
        }
      } else {
        await commandInteraction.reply({
          content: `Désolé, cette commande doit être lancée sur un serveur`,
          ephemeral: true,
        });
        return {
          cmd: "NewsCommand",
          result:
            "Impossible de positionner le canal d'envoi des news hors serveur",
        };
      }
    }

    await commandInteraction.reply({
      content: `Oops, il y a eu un problème. Je ne connais pas cette sous-commande`,
      ephemeral: true,
    });
    return {
      cmd: "NewsCommand",
      result: `Sous-commande ${commandInteraction.options.getSubcommand()} inconnue`,
    };
  }
}

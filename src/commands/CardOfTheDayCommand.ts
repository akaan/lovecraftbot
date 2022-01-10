import {
  ApplicationCommandSubCommandData,
  CommandInteraction,
} from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import { IApplicationCommand, IApplicationCommandResult } from "../interfaces";
import { CardOfTheDayService } from "../services/CardOfTheDayService";
import { GuildConfigurationService } from "../services/GuildConfigurationService";

/**
 * Commande d'administration de la carte du jour
 */
export class CardOfTheDayCommand implements IApplicationCommand {
  @Inject private cardOfTheDayService!: CardOfTheDayService;
  @Inject private guildConfigurationService!: GuildConfigurationService;

  isGuildCommand = true;

  commandData = {
    name: "cotd",
    description: "Commandes de gestion de la carte du jour",
    options: [
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "canal",
        description: "Définit le canal d'envoi de la carte du jour",
        options: [
          {
            type: ApplicationCommandOptionTypes.CHANNEL,
            name: "canal",
            description: "Le canal sur lequel envoyer la carte du jour",
            required: true,
          },
        ],
      } as ApplicationCommandSubCommandData,
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "encore",
        description: "Retire une nouvelle carte du jour",
      } as ApplicationCommandSubCommandData,
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "liste",
        description: "Liste des cartes déjà tirées",
      } as ApplicationCommandSubCommandData,
      {
        type: ApplicationCommandOptionTypes.SUB_COMMAND,
        name: "ajouter",
        description: "Ajoute des cartes à la liste des cartes déjà tirées",
        options: [
          {
            type: ApplicationCommandOptionTypes.STRING,
            name: "codes",
            description:
              "Codes des cartes (séparés par des virgules) à ajouter à la liste des cartes déjà tirées",
            required: true,
          },
        ],
      } as ApplicationCommandSubCommandData,
    ],
  };

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    if (!commandInteraction.guild) {
      await commandInteraction.reply({
        content: "Désolé, cette commande doit être exécutée sur un serveur",
        ephemeral: true,
      });
      return {
        cmd: "CardOdTheDayCommand",
        result: "Impossible d'exécuter cette commande hors serveur",
      };
    }

    if (commandInteraction.options.getSubcommand() === "canal") {
      if (commandInteraction.guild) {
        const channel = commandInteraction.options.getChannel("canal");
        if (channel && channel.type === "GUILD_TEXT") {
          await this.guildConfigurationService.setConfig(
            commandInteraction.guild,
            "cardOfTheDayChannelId",
            channel.id
          );
          await commandInteraction.reply({
            content: `C'est fait ! La carte du jour sera envoyée sur le canal ${channel.name}`,
            ephemeral: true,
          });
          return {
            cmd: "CardOdTheDayCommand",
            result: "Canal d'envoi de la carte du jour positionné",
            channelName: channel.name,
          };
        } else {
          await commandInteraction.reply({
            content: `Désolé, mais je n'ai pas trouvé ce canal ou son type ne convient pas`,
            ephemeral: true,
          });
          return {
            cmd: "CardOdTheDayCommand",
            result:
              "Impossible de positionner le canal d'envoi de la carte du jour",
            channel: channel,
          };
        }
      } else {
        await commandInteraction.reply({
          content: `Désolé, cette commande doit être lancée sur un serveur`,
          ephemeral: true,
        });
        return {
          cmd: "CardOdTheDayCommand",
          result:
            "Impossible de positionner le canal de la carte du jour hors serveur",
        };
      }
    }

    if (commandInteraction.options.getSubcommand() === "encore") {
      await this.cardOfTheDayService.sendCardOfTheDay(commandInteraction.guild);
      await commandInteraction.reply({
        content: "Nouvelle carte tirée !",
        ephemeral: true,
      });
      return {
        cmd: "CardOfTheDayCommand",
        result: `Nouvelle carte du jour envoyée`,
      };
    }

    if (commandInteraction.options.getSubcommand() === "liste") {
      const cardCodesSent = this.cardOfTheDayService.getCardCodesSent(
        commandInteraction.guild
      );
      await commandInteraction.reply({
        content:
          cardCodesSent.length > 0
            ? cardCodesSent.join(", ")
            : "Aucune carte n'a été tirée",
        ephemeral: true,
      });
      return {
        cmd: "CardOfTheDayCommand",
        result: `Liste des cartes du jour déjà tirées envoyée`,
      };
    }

    if (commandInteraction.options.getSubcommand() === "ajouter") {
      const codesText = commandInteraction.options.getString("codes");
      if (codesText) {
        const codes = codesText.split(",").map((s) => s.trim());
        await this.cardOfTheDayService.addCardSent(
          commandInteraction.guild,
          codes
        );
        await commandInteraction.reply({
          content: `Ces ${codes.length} carte(s) ont été ajoutée(s) à la liste des cartes déjà tirées`,
          ephemeral: true,
        });

        return { cmd: "CardOfTheDayCommand", result: "Codes ajoutés" };
      } else {
        return {
          cmd: "CardOfTheDayCommand",
          result: `Codes de carte non fournis`,
        };
      }
    }

    await commandInteraction.reply({
      content: `Oops, il y a eu un problème`,
      ephemeral: true,
    });
    return {
      cmd: "CardOfTheDayCommand",
      result: `Sous-commande ${commandInteraction.options.getSubcommand()} inconnue`,
    };
  }
}

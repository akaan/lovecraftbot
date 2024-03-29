import {
  ChannelType,
  ChatInputCommandInteraction,
  CommandInteraction,
  Guild,
  SlashCommandBuilder,
} from "discord.js";
import { Inject } from "typescript-ioc";

import {
  ApplicationCommandAccess,
  IApplicationCommand,
  IApplicationCommandResult,
} from "../interfaces";
import { CardOfTheDayService } from "../services/CardOfTheDayService";
import { GuildConfigurationService } from "../services/GuildConfigurationService";

/**
 * Commande d'administration de la carte du jour
 */
export class CardOfTheDayCommand implements IApplicationCommand {
  @Inject private cardOfTheDayService!: CardOfTheDayService;
  @Inject private guildConfigurationService!: GuildConfigurationService;

  commandAccess = ApplicationCommandAccess.ADMIN;

  commandData = new SlashCommandBuilder()
    .setName("cotd")
    .setDescription("Commandes de gestion de la carte du jour")
    .addSubcommand((subCommand) =>
      subCommand
        .setName("canal")
        .setDescription("Définit le canal d'envoi de la carte du jour")
        .addChannelOption((option) =>
          option
            .setName("canal")
            .setDescription("Le canal sur lequel envoyer la carte du jour")
            .setRequired(true)
        )
    )
    .addSubcommand((subCommand) =>
      subCommand
        .setName("heure")
        .setDescription("Définit l'heure d'envoi de la carte du jour")
        .addIntegerOption((option) =>
          option
            .setName("heure")
            .setDescription("L'heure à laquelle envoyer la carte du jour")
            .setRequired(true)
        )
    )
    .addSubcommand((subCommand) =>
      subCommand
        .setName("encore")
        .setDescription("Retire une nouvelle carte du jour")
    )
    .addSubcommand((subCommand) =>
      subCommand.setName("liste").setDescription("Liste des cartes déjà tirées")
    )
    .addSubcommand((subCommand) =>
      subCommand
        .setName("ajouter")
        .setDescription("Ajoute des cartes à la liste des cartes déjà tirées")
        .addStringOption((option) =>
          option
            .setName("codes")
            .setDescription(
              "Codes des cartes (séparés par des virgules) à ajouter à la liste des cartes déjà tirées"
            )
            .setRequired(true)
        )
    );

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    if (!commandInteraction.guild) {
      await commandInteraction.reply({
        content: "Désolé, cette commande doit être exécutée sur un serveur",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible d'exécuter cette commande hors serveur"
      );
    }

    if (!commandInteraction.isChatInputCommand()) {
      await commandInteraction.reply("Oups, y'a eu un problème");
      return { cmd: "CardOfTheDayCommand", result: "Interaction hors chat" };
    }

    if (commandInteraction.options.getSubcommand() === "canal") {
      return this.defineCardOfTheDayChannel(
        commandInteraction,
        commandInteraction.guild
      );
    }

    if (commandInteraction.options.getSubcommand() === "heure") {
      return this.defineCardOfTheDayHour(
        commandInteraction,
        commandInteraction.guild
      );
    }

    if (commandInteraction.options.getSubcommand() === "encore") {
      return this.sendCardOfTheDay(
        commandInteraction,
        commandInteraction.guild
      );
    }

    if (commandInteraction.options.getSubcommand() === "liste") {
      return this.sendCardCodesSent(
        commandInteraction,
        commandInteraction.guild
      );
    }

    if (commandInteraction.options.getSubcommand() === "ajouter") {
      return this.addCardCodesSent(
        commandInteraction,
        commandInteraction.guild
      );
    }

    await commandInteraction.reply({
      content: `Oops, il y a eu un problème`,
      ephemeral: true,
    });
    return this.commandResult(
      `Sous-commande ${commandInteraction.options.getSubcommand()} inconnue`
    );
  }

  /**
   * Traite le cas de la sous-commande définition du canal d'envoi de la carte
   * du jour.
   *
   * @param commandInteraction L'intéraction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async defineCardOfTheDayChannel(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    const channel = commandInteraction.options.getChannel("canal");
    if (channel && channel.type === ChannelType.GuildText) {
      await this.guildConfigurationService.setConfig(
        guild,
        "cardOfTheDayChannelId",
        channel.id
      );
      await commandInteraction.reply({
        content: `C'est fait ! La carte du jour sera envoyée sur le canal ${channel.name}`,
        ephemeral: true,
      });
      return this.commandResult(
        "Canal d'envoi de la carte du jour positionné",
        { channelName: channel.name }
      );
    } else {
      await commandInteraction.reply({
        content: `Désolé, mais je n'ai pas trouvé ce canal ou son type ne convient pas`,
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de positionner le canal d'envoi de la carte du jour",
        { channel }
      );
    }
  }

  /**
   * Traite le cas de la sous-commande définition de l'heure d'envoi de la carte
   * du jour.
   *
   * @param commandInteraction L'intéraction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async defineCardOfTheDayHour(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    const hour = commandInteraction.options.getInteger("heure");
    if (hour) {
      await this.guildConfigurationService.setConfig(
        guild,
        "cardOfTheDayHour",
        hour
      );
      await commandInteraction.reply({
        content: `C'est fait ! La carte du jour sera envoyée à ${hour}H`,
        ephemeral: true,
      });
      return this.commandResult(
        "Heure d'envoi de la carte du jour positionné",
        { hour }
      );
    } else {
      await commandInteraction.reply({
        content: `Désolé, mais il faut préciser l'heure`,
        ephemeral: true,
      });
      return this.commandResult(
        "Heure d'envoi de la carte du jour non fournie"
      );
    }
  }

  /**
   * Traite le cas de la sous-commande de renvoi d'une carte du jour.
   *
   * @param commandInteraction L'intéraction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async sendCardOfTheDay(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    await this.cardOfTheDayService.sendCardOfTheDay(guild);
    await commandInteraction.reply({
      content: "Nouvelle carte tirée !",
      ephemeral: true,
    });
    return this.commandResult(`Nouvelle carte du jour envoyée`);
  }

  /**
   * Traite le cas de la sous-commande d'ajout de codes de carte tirés.
   *
   * @param commandInteraction L'intéraction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async addCardCodesSent(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    const codesText = commandInteraction.options.getString("codes");
    if (codesText) {
      const codes = codesText.split(",").map((s) => s.trim());
      await this.cardOfTheDayService.addCardSent(guild, codes);
      await commandInteraction.reply({
        content: `Ces ${codes.length} carte(s) ont été ajoutée(s) à la liste des cartes déjà tirées`,
        ephemeral: true,
      });

      return this.commandResult("Codes ajoutés", { codes });
    } else {
      return {
        cmd: "CardOfTheDayCommand",
        result: `Codes de carte non fournis`,
      };
    }
  }

  /**
   * Traite le cas de la sous-commande d'affichage des codes de cartes tirés.
   *
   * @param commandInteraction L'intéraction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async sendCardCodesSent(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    const cardCodesSent = this.cardOfTheDayService.getCardCodesSent(guild);
    await commandInteraction.reply({
      content:
        cardCodesSent.length > 0
          ? cardCodesSent.join(", ")
          : "Aucune carte n'a été tirée",
      ephemeral: true,
    });
    return this.commandResult(`Liste des cartes du jour déjà tirées envoyée`);
  }

  /**
   * Permet de construire le résultat de la commande.
   *
   * @param result Le résultat de la commande
   * @param meta Les données supplémentaires à adjoindre
   * @returns Un résultat de commande complet
   */
  private commandResult(
    result: string,
    meta?: Omit<IApplicationCommandResult, "cmd" | "result">
  ) {
    return { cmd: "CardOfTheDayCommand", result, ...meta };
  }
}

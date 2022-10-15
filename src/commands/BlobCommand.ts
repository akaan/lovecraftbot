import {
  CommandInteraction,
  Channel,
  Guild,
  TextChannel,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { Inject } from "typescript-ioc";

import {
  ApplicationCommandAccess,
  IApplicationCommand,
  IApplicationCommandResult,
} from "../interfaces";
import { BlobGameService } from "../services/BlobGameService";
import { MassMultiplayerEventService } from "../services/MassMultiplayerEventService";

/** Commande pour les joueurs d'une partie du Dévoreur de Toute Chose */
export class BlobCommand implements IApplicationCommand {
  @Inject massMultiplayerEventService!: MassMultiplayerEventService;
  @Inject blobGameService!: BlobGameService;

  commandAccess = ApplicationCommandAccess.GUILD;

  commandData = new SlashCommandBuilder()
    .setName("blob")
    .setDescription(
      `Commandes joueurs pour une partie du Dévoreur de Tout Chose`
    )
    .addSubcommand((subCommand) =>
      subCommand
        .setName("i")
        .setDescription("Placer un nombre d'indices sur l'Acte 1")
        .addIntegerOption((option) =>
          option
            .setName("indices")
            .setDescription("Nombre d'indices")
            .setRequired(true)
        )
    )
    .addSubcommand((subCommand) =>
      subCommand
        .setName("cm-gain")
        .setDescription("Indiquer que des contre-mesures ont été gagnées")
        .addIntegerOption((option) =>
          option
            .setName("contre-mesures")
            .setDescription("Nombre de contre-mesures gagnées")
            .setRequired(true)
        )
    )
    .addSubcommand((subCommand) =>
      subCommand
        .setName("cm-depense")
        .setDescription("Indiquer que des contre-mesures ont été dépensées")
        .addIntegerOption((option) =>
          option
            .setName("contre-mesures")
            .setDescription("Nombre de contre-mesures dépensées")
            .setRequired(true)
        )
    )
    .addSubcommand((subCommand) =>
      subCommand
        .setName("d")
        .setDescription("Infliger un nombre de dégâts au Dévoreur")
        .addIntegerOption((option) =>
          option
            .setName("dégâts")
            .setDescription("Nombre de dégâts")
            .setRequired(true)
        )
    )
    .addSubcommand((subCommand) =>
      subCommand
        .setName("histoire")
        .setDescription("Obtenir un rappel de l'histoire sélectionnée")
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
      return this.commandResult("Oups, y'a eu un problème");
    }

    const channel = commandInteraction.channel;
    if (
      !channel ||
      !this.massMultiplayerEventService.isGroupChannel(
        commandInteraction.guild,
        channel as Channel
      )
    ) {
      await commandInteraction.reply({
        content:
          "Désolé, mais il faut être dans l'un des canaux de l'événement pour lancer cette commande",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible d'exécuter cette commande hors d'un canal dédié à un événement"
      );
    }

    if (!this.blobGameService.isGameRunning(commandInteraction.guild)) {
      await commandInteraction.reply({
        content:
          "Désolé, il n'y a pas de partie du Dévoreur de Toute Chose en cours",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible d'exécuter cette commande sans partie en cours"
      );
    }
    const subCommand = commandInteraction.options.getSubcommand();

    if (
      subCommand !== "histoire" &&
      !this.massMultiplayerEventService.isTimerRunning(commandInteraction.guild)
    ) {
      await commandInteraction.reply({
        content: "Désolé, il faut attendre que la minuterie soit active",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible d'exécuter cette commande sans minuterie active"
      );
    }

    if (subCommand === "i") {
      return this.placeCluesOnAct1(
        commandInteraction,
        commandInteraction.guild,
        // On a vérifié via massMultiplayerEventService#isGroupChannel
        channel as TextChannel
      );
    }

    if (subCommand === "d") {
      return this.dealDamageToBlob(
        commandInteraction,
        commandInteraction.guild,
        channel as TextChannel
      );
    }

    if (subCommand === "cm-gain") {
      return this.gainCounterMeasures(
        commandInteraction,
        commandInteraction.guild,
        channel as TextChannel
      );
    }

    if (subCommand === "cm-depense") {
      return this.spendCounterMeasures(
        commandInteraction,
        commandInteraction.guild,
        channel as TextChannel
      );
    }

    if (subCommand === "histoire") {
      return this.getStory(commandInteraction, commandInteraction.guild);
    }

    await commandInteraction.reply({
      content: "Je ne sais pas encore faire ça",
      ephemeral: true,
    });
    return this.commandResult("Commande non implémentée", {
      subCommand,
    });
  }

  /**
   * Traite le cas de la sous-commande de pose d'indices sur l'Acte 1.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  public async placeCluesOnAct1(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild,
    channel: TextChannel
  ): Promise<IApplicationCommandResult> {
    const numberOfClues = commandInteraction.options.getInteger("indices");
    if (!numberOfClues) {
      await commandInteraction.reply({
        content: "Ooops, je n'ai pas le nombre d'indices",
        ephemeral: true,
      });
      return this.commandResult("Impossible sans nombre d'indices");
    }

    if (numberOfClues > 3) {
      await commandInteraction.reply({
        content:
          "Désolé, il n'est pas possible de poser plus de 3 indices à la fois",
        ephemeral: true,
      });
      return this.commandResult("Impossible, trop d'indices");
    }

    await this.blobGameService.placeCluesOnAct1(guild, channel, numberOfClues);
    await commandInteraction.reply({
      content: `${numberOfClues} indice(s) posé(s) sur l'Acte 1`,
      ephemeral: true,
    });
    return this.commandResult("Indices posés sur l'Acte 1");
  }

  /**
   * Traite le cas de la sous-commande de gain de contre-mesures.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  public async gainCounterMeasures(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild,
    channel: TextChannel
  ): Promise<IApplicationCommandResult> {
    const numberOfCounterMeasures =
      commandInteraction.options.getInteger("contre-mesures");
    if (!numberOfCounterMeasures) {
      await commandInteraction.reply({
        content: "Ooops, je n'ai pas le nombre de contre-mesures",
        ephemeral: true,
      });
      return this.commandResult("Impossible sans nombre de contre-mesures");
    }

    await this.blobGameService.gainCounterMeasures(
      guild,
      channel,
      numberOfCounterMeasures
    );
    await commandInteraction.reply({
      content: `${numberOfCounterMeasures} contre-mesures gagnées`,
      ephemeral: true,
    });
    return this.commandResult("Contre-mesures gagnées");
  }

  /**
   * Traite le cas de la sous-commande de dépense de contre-mesures.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  public async spendCounterMeasures(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild,
    channel: TextChannel
  ): Promise<IApplicationCommandResult> {
    const numberOfCounterMeasures =
      commandInteraction.options.getInteger("contre-mesures");
    if (!numberOfCounterMeasures) {
      await commandInteraction.reply({
        content: "Ooops, je n'ai pas le nombre de contre-mesures",
        ephemeral: true,
      });
      return this.commandResult("Impossible sans nombre de contre-mesures");
    }

    if (
      !this.blobGameService.canSpendCounterMeasure(
        guild,
        numberOfCounterMeasures
      )
    ) {
      await commandInteraction.reply({
        content: "Désolé, vous n'avez pas assez de contre-mesures",
        ephemeral: true,
      });
      return this.commandResult("Impossible sans nombre de contre-mesures");
    }

    await this.blobGameService.spendCounterMeasures(
      guild,
      channel,
      numberOfCounterMeasures
    );
    await commandInteraction.reply({
      content: `${numberOfCounterMeasures} contre-mesures dépensées`,
      ephemeral: true,
    });
    return this.commandResult("Contre-mesures dépensées");
  }

  /**
   * Traite le cas de la sous-commande de pose de dégâts sur le Dévoreur.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  public async dealDamageToBlob(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild,
    channel: TextChannel
  ): Promise<IApplicationCommandResult> {
    const numberOfDamageDealtToBlob =
      commandInteraction.options.getInteger("dégâts");
    if (!numberOfDamageDealtToBlob) {
      await commandInteraction.reply({
        content: "Ooops, je n'ai pas le nombre de dégâts",
        ephemeral: true,
      });
      return this.commandResult("Impossible sans nombre de dégâts");
    }

    await this.blobGameService.dealDamageToBlob(
      guild,
      channel,
      numberOfDamageDealtToBlob
    );
    await commandInteraction.reply({
      content: `${numberOfDamageDealtToBlob} dégât(s) infligé(s) au Dévoreur`,
      ephemeral: true,
    });
    return this.commandResult("Dégâts infligés au Dévoreur");
  }

  /**
   * Traite le cas de la sous-commande de demande de l'histoire sélectionnée.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  public async getStory(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    const story = this.blobGameService.getStory(guild);
    if (story) {
      await commandInteraction.reply({
        content: `L'histoire sélectionnée pour cette partie est : ${story}.`,
      });
    } else {
      await commandInteraction.reply({
        content: `Pas encore d'histoire sélectionnée pour cette partie.`,
      });
    }

    return this.commandResult("Histoire envoyée");
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
    return { cmd: "BlobCommand", result, ...meta };
  }
}

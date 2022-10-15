import {
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
import { BlobGameService } from "../services/BlobGameService";
import { MassMultiplayerEventService } from "../services/MassMultiplayerEventService";

/** Commande de gestion d'une partie du Dévoreur de Toute Chose */
export class AdminBlobCommand implements IApplicationCommand {
  @Inject blobGameService!: BlobGameService;
  @Inject massMultiplayerEventService!: MassMultiplayerEventService;

  commandAccess = ApplicationCommandAccess.ADMIN;

  commandData = new SlashCommandBuilder()
    .setName("ablob")
    .setDescription(
      `Commandes de gestion d'une partie du Dévoreur de Tout Chose`
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("start")
        .setDescription("Démarre une partie du Dévoreur de Toute Chose")
        .addIntegerOption((option) =>
          option
            .setName("joueurs")
            .setDescription("Nombre de joueurs")
            .setRequired(true)
        )
    )
    .addSubcommand((subCommand) =>
      subCommand
        .setName("i")
        .setDescription("Corrige le nombre d'indices sur l'Acte 1")
        .addIntegerOption((option) =>
          option
            .setName("indices")
            .setDescription("Nombre d'indices sur l'Acte 1")
            .setRequired(true)
        )
    )
    .addSubcommand((subCommand) =>
      subCommand
        .setName("cm")
        .setDescription("Corrige le nombre de contre-mesures disponibles")
        .addIntegerOption((option) =>
          option
            .setName("contre-mesures")
            .setDescription("Nombre de contre-mesures")
            .setRequired(true)
        )
    )
    .addSubcommand((subCommand) =>
      subCommand
        .setName("d")
        .setDescription("Corrige le nombre de dégâts sur le Dévoreur")
        .addIntegerOption((option) =>
          option
            .setName("dégâts")
            .setDescription("Nombre de dégâts")
            .setRequired(true)
        )
    )
    .addSubcommand((subCommand) =>
      subCommand
        .setName("end")
        .setDescription("Met fin à la partie du Dévoreur de Toute Chose")
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

    const subCommand = commandInteraction.options.getSubcommand();

    if (subCommand === "start") {
      return this.startNewGame(commandInteraction, commandInteraction.guild);
    }

    if (subCommand === "end") {
      return this.endGame(commandInteraction, commandInteraction.guild);
    }

    if (subCommand === "i") {
      return this.fixClues(commandInteraction, commandInteraction.guild);
    }

    if (subCommand === "cm") {
      return this.fixNumberOfCounterMeasures(
        commandInteraction,
        commandInteraction.guild
      );
    }

    if (subCommand === "d") {
      return this.fixDamageDealtToBlob(
        commandInteraction,
        commandInteraction.guild
      );
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
   * Traite le cas de la sous-commande de démarage d'une nouvelle partie.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  public async startNewGame(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    if (this.blobGameService.isGameRunning(guild)) {
      await commandInteraction.reply({
        content: "Impossible, il y a déjà une partie en cours",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de démarrer une partie car il y en a déjà une en cours"
      );
    }

    if (!this.massMultiplayerEventService.isEventRunning(guild))
      return this.noEvent(commandInteraction, "start");

    const numberOfPlayers = commandInteraction.options.getInteger("joueurs");
    if (!numberOfPlayers) {
      await commandInteraction.reply({
        content: "Ooops, je n'ai pas le nombre de joueurs",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de démarrer une minuterie sans la nombre de joueurs"
      );
    }

    await this.blobGameService.startNewGame(guild, numberOfPlayers);
    await commandInteraction.reply({
      content: "Nouvelle partie du Dévoreur de Toute Chose démarrée !",
      ephemeral: true,
    });
    return this.commandResult("Partie du Dévoreur démarrée");
  }

  /**
   * Traite le cas de la sous-commande de fin d'une partie.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  public async endGame(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    if (!this.blobGameService.isGameRunning(guild)) {
      return this.noGame(commandInteraction, "end");
    }

    await this.blobGameService.endGame(guild);
    await commandInteraction.reply({
      content: "Partie Dévoreur de Toute Chose terminée !",
      ephemeral: true,
    });
    return this.commandResult("Partie du Dévoreur terminée");
  }

  /**
   * Traite le cas de la sous-commande de correction du nombre d'indices sur
   * l'acte 1.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  public async fixClues(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    if (!this.blobGameService.isGameRunning(guild)) {
      return this.noGame(commandInteraction, "i");
    }

    const numberOfClues = commandInteraction.options.getInteger("indices");
    if (numberOfClues == undefined) {
      await commandInteraction.reply({
        content: "Ooops, je n'ai pas le nombre d'indices",
        ephemeral: true,
      });
      return this.commandResult("Impossible de corriger sans nombre d'indices");
    }

    await this.blobGameService.fixNumberOfCluesOnAct1(guild, numberOfClues);
    await commandInteraction.reply({
      content: "Nombre d'indices sur l'acte 1 corrigé !",
      ephemeral: true,
    });
    return this.commandResult("Nombre d'indices sur l'acte 1 corrigé");
  }

  /**
   * Traite le cas de la sous-commande de correction du nombre d'indices sur
   * l'acte 1.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  public async fixNumberOfCounterMeasures(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    if (!this.blobGameService.isGameRunning(guild)) {
      return this.noGame(commandInteraction, "cm");
    }

    const numberOfCounterMeasures =
      commandInteraction.options.getInteger("contre-mesures");
    if (numberOfCounterMeasures == undefined) {
      await commandInteraction.reply({
        content: "Ooops, je n'ai pas le nombre de contre-mesures",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de corriger sans nombre de contre-mesures"
      );
    }

    await this.blobGameService.fixNumberOfCounterMeasures(
      guild,
      numberOfCounterMeasures
    );
    await commandInteraction.reply({
      content: "Nombre de contre-mesures corrigé !",
      ephemeral: true,
    });
    return this.commandResult("Nombre de contre-mesures corrigé");
  }

  /**
   * Traite le cas de la sous-commande de correction du nombre de dégâts sur le
   * Dévoreur.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  public async fixDamageDealtToBlob(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    if (!this.blobGameService.isGameRunning(guild)) {
      return this.noGame(commandInteraction, "d");
    }

    const numberOfDamages = commandInteraction.options.getInteger("dégâts");
    if (numberOfDamages == undefined) {
      await commandInteraction.reply({
        content: "Ooops, je n'ai pas le nombre de dégâts",
        ephemeral: true,
      });
      return this.commandResult("Impossible de corriger sans nombre de dégâts");
    }

    await this.blobGameService.fixNumberOfDamageDealtToBlob(
      guild,
      numberOfDamages
    );
    await commandInteraction.reply({
      content: "Nombre de dégâts sur le Dévoreur corrigé !",
      ephemeral: true,
    });
    return this.commandResult("Nombre de dégâts sur le Dévoreur corrigé");
  }

  /**
   * Répond qu'il n'y a pas d'événement en cours.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async noEvent(
    commandInteraction: ChatInputCommandInteraction,
    subCommand: string
  ): Promise<IApplicationCommandResult> {
    await commandInteraction.reply({
      content: "Impossible, il n'y a pas d'événement en cours",
      ephemeral: true,
    });
    return this.commandResult("Impossible : pas d'événement en cours", {
      subCommand,
    });
  }

  /**
   * Répond qu'il n'y a pas de partie en cours.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async noGame(
    commandInteraction: ChatInputCommandInteraction,
    subCommand: string
  ): Promise<IApplicationCommandResult> {
    await commandInteraction.reply({
      content: "Impossible, il n'y a pas de partie du Dévoreur en cours",
      ephemeral: true,
    });
    return this.commandResult("Impossible : pas de partie en cours", {
      subCommand,
    });
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
    return { cmd: "AdminBlobCommand", result, ...meta };
  }
}

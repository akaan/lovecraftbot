import {
  CategoryChannel,
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
import {
  MassMultiplayerEventService,
  TimerEvent,
} from "../services/MassMultiplayerEventService";

/** Commande de gestion des événements multijoueurs */
export class EventCommand implements IApplicationCommand {
  @Inject massMultiplayerEventService!: MassMultiplayerEventService;

  commandAccess = ApplicationCommandAccess.ADMIN;

  commandData = new SlashCommandBuilder()
    .setName("evt")
    .setDescription(`Commandes de gestion des événements multijoueurs`)
    .addSubcommand((subCommand) =>
      subCommand
        .setName("start")
        .setDescription("Démarre un événement multijoueurs")
        .addChannelOption((option) =>
          option
            .setName("catégorie")
            .setDescription(
              "La catégorie de canaux dans laquelle créer les canaux"
            )
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("groupes")
            .setDescription("Nombre de groupes")
            .setRequired(true)
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("timer")
        .setDescription("Gestion de la minuterie")
        .addSubcommand((subCommand) =>
          subCommand
            .setName("start")
            .setDescription("Démarre la minuterie")
            .addIntegerOption((option) =>
              option
                .setName("minutes")
                .setDescription("Nombre de minutes")
                .setRequired(true)
            )
        )
        .addSubcommand((subCommand) =>
          subCommand
            .setName("pause")
            .setDescription("Met la minuterie en pause")
        )
        .addSubcommand((subCommand) =>
          subCommand.setName("resume").setDescription("Redémarre la minuterie")
        )
    )
    .addSubcommand((subCommand) =>
      subCommand
        .setName("msg")
        .setDescription("Envoie un message à tous les groupes")
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription("Le message à envoyer")
            .setRequired(true)
        )
    )
    .addSubcommand((subCommand) =>
      subCommand
        .setName("end")
        .setDescription("Met fin à l'événement multijoueurs")
    );

  constructor() {
    this.massMultiplayerEventService.addTimerListener(
      this.tellTimeRemaining.bind(this)
    );
  }

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
      return { cmd: "EventCommand", result: "Interaction hors chat" };
    }

    const subCommandGroup =
      commandInteraction.options.getSubcommandGroup(false);
    const subCommand = commandInteraction.options.getSubcommand();

    if (subCommandGroup === null && subCommand === "start") {
      return this.startEvent(commandInteraction, commandInteraction.guild);
    }

    if (subCommandGroup === null && subCommand === "msg") {
      return this.broadcastMessage(
        commandInteraction,
        commandInteraction.guild
      );
    }

    if (subCommandGroup === null && subCommand === "end") {
      return this.endEvent(commandInteraction, commandInteraction.guild);
    }

    if (subCommandGroup === "timer" && subCommand === "start") {
      return this.startTimer(commandInteraction, commandInteraction.guild);
    }

    if (subCommandGroup === "timer" && subCommand === "pause") {
      return this.pauseTimer(commandInteraction, commandInteraction.guild);
    }

    if (subCommandGroup === "timer" && subCommand === "resume") {
      return this.resumeTimer(commandInteraction, commandInteraction.guild);
    }

    await commandInteraction.reply({
      content: "Je ne sais pas encore faire ça",
      ephemeral: true,
    });
    return this.commandResult("Commande non implémentée", {
      subCommandGroup,
      subCommand,
    });
  }

  /**
   * Traite le cas de la sous-commande de démarrage d'un événement multijoueurs.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async startEvent(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    if (this.massMultiplayerEventService.isEventRunning(guild)) {
      await commandInteraction.reply({
        content: "Impossible, il y a déjà un événement en cours",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de démarrer l'événement : il y en a déjà un en cours"
      );
    }

    const numberOfGroups = commandInteraction.options.getInteger("groupes");
    if (!numberOfGroups) {
      await commandInteraction.reply({
        content: "Ooops, je n'ai pas le nombre de groupes",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de démarrer l'événement sans le nombre de groupes"
      );
    }

    const categoryChannel = commandInteraction.options.getChannel("catégorie");
    if (
      !categoryChannel ||
      !(categoryChannel.type === ChannelType.GuildCategory)
    ) {
      await commandInteraction.reply({
        content: "Impossible sans précisr une catégorie de canaux valide",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de démarrer l'événement sans une catégorie de canaux"
      );
    }

    await this.massMultiplayerEventService.startEvent(
      guild,
      categoryChannel as CategoryChannel,
      numberOfGroups
    );

    await commandInteraction.reply({
      content: "Evénement démarré !",
      ephemeral: true,
    });
    return this.commandResult("Evénement démarré");
  }

  /**
   * Traite le cas de la sous-commande d'envoi de message à tous les groupes
   * d'un événement multijoueurs.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async broadcastMessage(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    if (!this.massMultiplayerEventService.isEventRunning(guild)) {
      await commandInteraction.reply({
        content: "Impossible, il n'y a pas d'événement en cours",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible d'envoyer un message : il n'y a pas d'événement en cours"
      );
    }

    const message = commandInteraction.options.getString("message");
    if (!message) {
      await commandInteraction.reply({
        content: "Ooops, je n'ai pas le message à envoyer",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible d'envoyer un message sans le message"
      );
    }

    await this.massMultiplayerEventService.broadcastMessage(guild, {
      content: message,
    });

    await commandInteraction.reply({
      content: "Message envoyé !",
      ephemeral: true,
    });
    return this.commandResult("Message envoyé");
  }

  /**
   * Traite le cas de la sous-commande de fin d'un événement multijoueurs.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async endEvent(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    if (!this.massMultiplayerEventService.isEventRunning(guild)) {
      await commandInteraction.reply({
        content: "Impossible, il n'y a pas d'événement en cours",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de mettre fin l'événement : il n'y en a pas en cours"
      );
    }

    await this.massMultiplayerEventService.endEvent(guild);

    await commandInteraction.reply({
      content: "Evénement terminé !",
      ephemeral: true,
    });
    return this.commandResult("Evénement terminé");
  }

  /**
   * Traite le cas de la sous-commande de démarrage de minuterie.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async startTimer(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    if (!this.massMultiplayerEventService.isEventRunning(guild)) {
      return this.noEvent(commandInteraction);
    }
    if (this.massMultiplayerEventService.isTimerRunning(guild)) {
      await commandInteraction.reply({
        content: "Impossible, il y a déjà une minuterie en cours",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de démarrer une minuterie : il y en a déjà une en cours"
      );
    }

    const minutes = commandInteraction.options.getInteger("minutes");
    if (!minutes) {
      await commandInteraction.reply({
        content: "Ooops, je n'ai pas le nombre de minutes",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de démarrer une minuterie sans la nombre de minutes"
      );
    }

    this.massMultiplayerEventService.startTimer(guild, minutes);

    await commandInteraction.reply({
      content: "Minuterie démarrée !",
      ephemeral: true,
    });
    return this.commandResult("Minuterie démarrée", { minutes });
  }

  /**
   * Traite le cas de la sous-commande de pause de la minuterie.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async pauseTimer(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    if (!this.massMultiplayerEventService.isEventRunning(guild)) {
      return this.noEvent(commandInteraction);
    }
    if (!this.massMultiplayerEventService.isTimerRunning(guild)) {
      await commandInteraction.reply({
        content: "Impossible, il n'y a pas de minuterie en cours",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de mettre en pause la minuterie : il n'y en a pas en cours"
      );
    }

    this.massMultiplayerEventService.pauseTimer(guild);

    await commandInteraction.reply({
      content: "Minuterie en pause !",
      ephemeral: true,
    });
    return this.commandResult("Minuterie mise en pause");
  }

  /**
   * Traite le cas de la sous-commande de remise en route de la minuterie.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @param guild Le serveur concerné
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async resumeTimer(
    commandInteraction: ChatInputCommandInteraction,
    guild: Guild
  ): Promise<IApplicationCommandResult> {
    if (!this.massMultiplayerEventService.isEventRunning(guild)) {
      return this.noEvent(commandInteraction);
    }
    if (this.massMultiplayerEventService.isTimerRunning(guild)) {
      await commandInteraction.reply({
        content: "Impossible, la minuterie est déjà cours",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de remettre en marche la minuterie : elle est déjà en cours"
      );
    }

    if (
      this.massMultiplayerEventService.getTimeRemaining(guild) === undefined
    ) {
      await commandInteraction.reply({
        content:
          "Impossible, la minuterie n'a pas été initialisée avec un nombre de minutes.",
        ephemeral: true,
      });
      return this.commandResult(
        "Impossible de remettre en marche la minuterie : elle n'a pas été initialisée"
      );
    }

    this.massMultiplayerEventService.resumeTimer(guild);

    await commandInteraction.reply({
      content: "Minuterie redémarrée !",
      ephemeral: true,
    });
    return this.commandResult("Minuterie redémarrée");
  }

  /**
   * Répond qu'il n'y a pas d'événement en cours.
   *
   * @param commandInteraction L'interaction déclenchée par la commande
   * @returns Une promesse résolue avec le résultat de la commande
   */
  private async noEvent(
    commandInteraction: ChatInputCommandInteraction
  ): Promise<IApplicationCommandResult> {
    await commandInteraction.reply({
      content: "Impossible, il n'y a pas d'événement en cours",
      ephemeral: true,
    });
    return this.commandResult(
      "Impossible de mettre fin l'événement : il n'y en a pas en cours"
    );
  }

  /**
   * Tient les joueurs au courant du temps restant.
   *
   * @param guild Le serveur concerné
   * @param event L'événement survenu
   * @param remaining Le temps restant
   */
  private tellTimeRemaining(
    guild: Guild,
    event: TimerEvent,
    remaining: number | undefined
  ): void {
    if (!this.massMultiplayerEventService.isEventRunning(guild)) return;

    if (event === "start" || event === "resume") {
      void this.massMultiplayerEventService.broadcastMessage(guild, {
        content: `Démarrage de la minuterie !`,
      });
    }

    if (event === "pause") {
      void this.massMultiplayerEventService.broadcastMessage(guild, {
        content: `La minuterie a été mise en pause.`,
      });
    }

    if (event === "tick") {
      if (remaining !== undefined) {
        if (
          (remaining >= 60 && remaining % 15 === 0) ||
          (remaining < 60 && remaining >= 30 && remaining % 10 === 0) ||
          (remaining < 30 && remaining >= 10 && remaining % 5 === 0) ||
          (remaining < 10 && remaining > 0)
        ) {
          void this.massMultiplayerEventService.broadcastMessage(guild, {
            content: `Il ne reste plus que ${remaining} minute(s)`,
          });
        }
      }
    }

    if (event === "ended") {
      void this.massMultiplayerEventService.broadcastMessage(guild, {
        content: `Le temps est écoulé ! C'est fini.`,
      });
    }
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
    return { cmd: "EventCommand", result, ...meta };
  }
}

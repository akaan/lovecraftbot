import {
  ChatInputApplicationCommandData,
  CommandInteraction,
} from "discord.js";

/**
 * Le niveau d'accès de la commande
 */
export enum ApplicationCommandAccess {
  /** Commande globale, accessible hors serveur */
  GLOBAL,

  /** Commande accessible uniquement sur un serveur */
  GUILD,

  /**
   * Commande accessibles uniquement sur un serveur et pour les amdinsitrateurs
   */
  ADMIN,
}

/**
 * Représente le résultat d'une commande d'application.
 */
export interface IApplicationCommandResult {
  /** Nom de la commande d'application exécutée */
  cmd: string;

  /** Message de résultat de la commande */
  result: string;

  /* Autres données */
  [key: string]: unknown;
}

/** Représente une commande d'application reconnue par le bot. */
export interface IApplicationCommand {
  /** Niveau d'accès de la commande */
  commandAccess: ApplicationCommandAccess;

  /**
   * Les données de configuration de la commande d'application.
   */
  commandData: ChatInputApplicationCommandData;

  /**
   * Exécute la commande d'application.
   *
   * @param interaction L'interaction à l'origine de l'exécution de cette commande
   * @returns Le résultat de l'exécution de la commande
   */
  execute(interaction: CommandInteraction): Promise<IApplicationCommandResult>;
}

/**
 * Constructeur d'une commande d'application
 */
export type ApplicationCommandConstructor<T = IApplicationCommand> =
  new () => T;

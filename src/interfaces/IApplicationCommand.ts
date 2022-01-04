import {
  ChatInputApplicationCommandData,
  CommandInteraction,
} from "discord.js";

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
export interface IApplicationCommand extends ChatInputApplicationCommandData {
  /**
   * Indique sur la commande est une commande de serveur.
   * Si ce n'est pas le cas, c'est une commande globale.
   * */
  isGuildCommand: boolean;

  /**
   * Exécute la commande d'application.
   *
   * @param interaction L'interaction à l'origine de l'exécution de cette commande
   */
  execute(interaction: CommandInteraction): Promise<IApplicationCommandResult>;
}

/**
 * Constructeur d'une commande d'application
 */
export type ApplicationCommandConstructor<T = IApplicationCommand> =
  new () => T;

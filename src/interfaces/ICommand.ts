import * as Discord from "discord.js";

/**
 * Résultat d'une commande classique.
 */
export interface ICommandResult {
  resultString?: string;
  result?: unknown;
}

/**
 * Arguments (paramètres) d'une commande classique.
 */
export interface ICommandArgs {
  /** Oui si la commande doit être exécutée en mode debug */
  debug?: boolean;

  /** Le nom de la commande déclenchée */
  cmd: string;

  /** Les arguments (paramètres) fournis à la commande */
  args: string;

  /** Le message ayant déclenché la commande */
  message: Discord.Message;

  /** L'utilisateur ayant déclenché la commande */
  user: Discord.User;
}

/**
 * Une commande classique (i.e. déclenchée par un message utilisateur
 * commençant par le préfixe de commande). Chaque commande ne sera
 * instanciée qu'une seule fois par le {@link CommandParser} qui se
 * chargera ensuite de les exécuter.
 */
export interface ICommand {
  /** Le texte d'aide associé à la commande */
  help: string;

  /** Les différents mots permettant de déclencher la commande */
  aliases?: string[];

  /** Vrai si la commande ne devrait être réservée qu'au administrateurs */
  admin?: boolean;

  /**
   * Méthode appelée lorsque l'un des alias a été détecté et si cette méthode
   * est implémentée par la commande.
   *
   * @param args Les arguments passés à la commande
   */
  execute?(args: ICommandArgs): Promise<ICommandResult>;

  /**
   * Méthode appelée chaque fois qu'un message est envoyé sur le serveur et
   * si cette méthode est implémentée par la commande.
   *
   * @param message Le message envoyé
   */
  onMessage?(message: Discord.Message): void;

  /**
   * Méthode appelée chaque fois qu'une réaction est ajoutée à un message et
   * si cette méthode est implémentée par la commande.
   *
   * @param reaction La réaction ajoutée
   * @param user L'utilisateur ayant ajoutée la réaction
   */
  onEmojiAdd?(
    reaction: Discord.MessageReaction,
    user: Discord.User | Discord.PartialUser
  ): void;

  /**
   * Méthode appelée chaque fois qu'une réaction est retirée d'un message et
   * si cette méthode est implémentée par la commande.
   *
   * @param reaction La réaction retirée
   * @param user L'utilisateur ayant ajoutée la réaction
   */
  onEmojiRemove?(
    reaction: Discord.MessageReaction,
    user: Discord.User | Discord.PartialUser
  ): void;
}

/** Constructeur d'une commande classique */
export type CommandConstructor<T = ICommand> = new () => T;

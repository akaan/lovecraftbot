import * as Discord from "discord.js";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";

import { BaseService } from "../base/BaseService";
import * as Commands from "../commands/nonApplicationCommands";
import { ICommandResult, ICommand, CommandConstructor } from "../interfaces";

import { EnvService } from "./EnvService";
import { HelpService } from "./HelpService";
import { RoleService } from "./RoleService";

/** Type représentant un dictionnaire de commandes */
type CommandsDictionary = { [key: string]: CommandConstructor };

/** Dictionnaire de l'ensemble des commandes importées */
const AvailableCommands = Commands as unknown as CommandsDictionary;

@Singleton
@OnlyInstantiableByContainer
/**
 * Service gérant et exécutant les commandes classiques, c'est-à-dire
 * déclenchées via des messages.
 */
export class CommandParser extends BaseService {
  @Inject private envService!: EnvService;
  @Inject private roleService!: RoleService;
  @Inject private helpService!: HelpService;

  /** Dictionnaire des commandes exécutables via préfixe et alias */
  private executableCommands: { [key: string]: ICommand } = {};

  /** Liste des commandes se déclenchant sur simple message (sans prefixe ni alias) */
  private messageCommands: ICommand[] = [];

  /** Liste des commandes se déclenchant sur l'ajout d'une réaction à un message */
  private emojiAddCommands: ICommand[] = [];

  /** Liste des commandes se déclenchant sur le retrait d'une réaction d'un message */
  private emojiRemoveCommands: ICommand[] = [];

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);
    this.loadCommands(AvailableCommands);
  }

  /**
   * Exécuté pour chaque message envoyé. Toutes les commandes classiques
   * implémentant {@link ICommand#onMessage} seront appelées.
   *
   * @param message Le message envoyé
   */
  public handleMessage(message: Discord.Message): void {
    this.messageCommands.forEach((cmd) => {
      if (cmd.onMessage) cmd.onMessage(message);
      return;
    });
  }

  /**
   * Exécuté chaque fois qu'une réaction est ajoutée à un message. Toutes
   * les commandes classiques implémentant {@link ICommand#onEmojiAdd}
   * seront appelées.
   *
   * @param reaction La réaction ajoutée
   * @param user L'utilisateur ayant ajouté la réaction
   */
  public handleEmojiAdd(
    reaction: Discord.MessageReaction,
    user: Discord.User | Discord.PartialUser
  ): void {
    this.emojiAddCommands.forEach((cmd) => {
      if (cmd.onEmojiAdd) cmd.onEmojiAdd(reaction, user);
      return;
    });
  }

  /**
   * Exécuté chaque fois qu'une réaction est retirée d'un message. Toutes
   * les commandes classiques implémentant {@link ICommand#onEmojiRemove}
   * seront appelées.
   *
   * @param reaction La réaction retirée
   * @param user L'utilisateur ayant retiré la réaction
   */
  public handleEmojiRemove(
    reaction: Discord.MessageReaction,
    user: Discord.User | Discord.PartialUser
  ): void {
    this.emojiRemoveCommands.forEach((cmd) => {
      if (cmd.onEmojiRemove) cmd.onEmojiRemove(reaction, user);
      return;
    });
  }

  /**
   * Exécuté chaque fois qu'une commande est déclenchée via préfixe et alias :
   * détermine la commande consernée et l'exécute si elle a été trouvée.
   *
   * @param message Le message ayant déclenché la commande
   * @returns Le résultat de l'exécution de la commande
   */
  async handleCommand(message: Discord.Message): Promise<ICommandResult> {
    const cmd = message.content.split(" ")[0].substring(1);
    const args = message.content.substring(
      message.content.indexOf(cmd) + cmd.length + 1
    );

    const cmdInst = this.executableCommands[cmd.toLowerCase()];
    if (!cmdInst || !cmdInst.execute) {
      await message.reply(
        `Hmmm, je ne connais pas de commande ${this.envService.commandPrefix}${cmd}. Peut-être devrais-tu essayer /aide ?`
      );
      return { resultString: `Pas de commande pour ${cmd}` };
    }

    if (cmdInst.admin) {
      const botAdminRole = this.envService.botAdminRoleName;
      if (!botAdminRole) {
        throw new Error(
          `La commande ${cmd} requiert des droits Admin mais ce rôle n'a pas été défini via BOT_ADMIN_ROLE`
        );
      }
      if (!this.roleService.isMessageFromRole(message, botAdminRole)) {
        return {
          resultString: `La commande ${cmd} est une commande Admin et ${message.author.username} n'a pas ce rôle`,
        };
      }
    }

    return cmdInst.execute({
      debug: false,
      cmd,
      args,
      message,
      user: message.author,
    });
  }

  /**
   * Instancie l'ensemble des commandes importées à partir de leurs
   * définitions puis les enregistre.
   *
   * @param commands Le dictionnaire des définitions de commandes importées
   */
  private loadCommands(commands: CommandsDictionary): void {
    Object.values(commands).forEach((cmdCtor) => {
      const cmdInst: ICommand = new cmdCtor();
      this.registerCommand(cmdInst);
    });
  }

  /**
   * Enregistre une commande instanciée en la référençant dans les listes
   * selon ses modes de déclenchement (exécution sur préfixe et alias,
   * sur message, sur ajout ou retrait de réaction).
   *
   * @param cmdInst La commande instanciée
   */
  private registerCommand(cmdInst: ICommand) {
    if (cmdInst.help && cmdInst.aliases) {
      this.helpService.addHelp({
        command: cmdInst.constructor.name,
        aliases: cmdInst.aliases,
        help: cmdInst.help,
        admin: cmdInst.admin !== undefined && cmdInst.admin,
      });
    }

    if (cmdInst.aliases) {
      cmdInst.aliases.forEach((alias) => {
        alias = alias.toLowerCase();

        if (this.executableCommands[alias]) {
          throw new Error(
            `Cannot re-register alias "${alias}".
            Trying to register ${JSON.stringify(
              cmdInst
            )} but already registered ${JSON.stringify(
              this.executableCommands[alias]
            )}.`
          );
        }

        if (!cmdInst.execute) {
          throw new Error(
            `Command "${alias}" does not have an execute function.`
          );
        }
        this.executableCommands[alias] = cmdInst;
      });
    }

    if (cmdInst.onMessage) {
      this.messageCommands.push(cmdInst);
    }

    if (cmdInst.onEmojiAdd) {
      this.emojiAddCommands.push(cmdInst);
    }

    if (cmdInst.onEmojiRemove) {
      this.emojiRemoveCommands.push(cmdInst);
    }
  }
}

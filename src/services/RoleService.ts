import { Message } from "discord.js";
import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

@Singleton
@OnlyInstantiableByContainer
/**
 * Service permettant des opérations vis-à-vis des rôles sur un serveur Discord.
 */
export class RoleService extends BaseService {
  /**
   * Vérifie si le message fourni provient bien d'un membre ayant le rôle dont
   * le nom est fourni.
   *
   * @param message Le message concerné
   * @param roleName Le rôle vérifié
   * @returns Vrai si le message provient bien d'un membre ayant le rôle indiqué
   */
  public isMessageFromRole(message: Message, roleName: string): boolean {
    if (message.member) {
      return message.member.roles.cache.some((role) => role.name === roleName);
    }
    return false;
  }
}

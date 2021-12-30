import { Message } from "discord.js";
import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

@Singleton
@OnlyInstantiableByContainer
export class RoleService extends BaseService {
  public isMessageFromRole(message: Message, roleName: string): boolean {
    if (message.member) {
      return message.member.roles.cache.some((role) => role.name === roleName);
    }
    return false;
  }
}

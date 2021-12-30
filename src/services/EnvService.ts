import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

@Singleton
@OnlyInstantiableByContainer
export class EnvService extends BaseService {
  public get discordToken(): string | undefined {
    return process.env.DISCORD_TOKEN;
  }

  public get commandPrefix(): string {
    return process.env.COMMAND_PREFIX || "!";
  }

  public get ignorePresence(): boolean {
    return !!process.env.IGNORE_PRESENCE;
  }

  public get testServerId(): string | undefined {
    return process.env.TEST_SERVER;
  }

  public get cardOfTheDayChannelId(): string | undefined {
    return process.env.CARD_OF_THE_DAY_CHANNEL;
  }

  public get cardOfTheDayHour(): number {
    const parsed = parseInt(process.env.CARD_OF_THE_DAY_HOUR || "8", 10);
    if (isNaN(parsed)) {
      return 8;
    } else {
      return parsed;
    }
  }

  public get massMultiplayerEventCategoryName(): string | undefined {
    return process.env.MASS_MULTIPLAYER_EVENT_CATEGORY;
  }

  public get massMultiplayerEventAdminChannelName(): string | undefined {
    return process.env.MASS_MULTIPLAYER_EVENT_ADMIN_CHANNEL;
  }

  public get botAdminRoleName(): string | undefined {
    return process.env.BOT_ADMIN_ROLE;
  }
}

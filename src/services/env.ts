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
}

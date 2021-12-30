/* eslint-disable no-console */
import * as Discord from "discord.js";
import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";
import { ICommandResult } from "../interfaces";

@Singleton
@OnlyInstantiableByContainer
export class LoggerService extends BaseService {
  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);

    this.watchGlobalUncaughtExceptions();
  }

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  log(...args: any[]): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    console.log(this.timeStamp(), ...args);
  }

  logCommandResult(result: ICommandResult): void {
    if (!result || (!result.result && !result.resultString)) {
      return;
    }
    this.log(result);
  }

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  error(...args: any[]): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    console.error(this.timeStamp(), ...args);
  }

  private timeStamp() {
    return new Date();
  }

  private watchGlobalUncaughtExceptions() {
    process.on("uncaughtException", (e) => {
      this.error(e);
      process.exit(0);
    });
  }
}

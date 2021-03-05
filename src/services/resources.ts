import * as fs from "fs";
import * as util from "util";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";
import { BaseService } from "../base/BaseService";
import { LoggerService } from "./logger";

const readFile = util.promisify(fs.readFile);

@Singleton
@OnlyInstantiableByContainer
export class ResourcesService extends BaseService {
  @Inject logger?: LoggerService;

  public readResource(filename: string): Promise<string | undefined> {
    return readFile(`./data/${filename}`, "utf-8").catch((err) => {
      if (this.logger) this.logger.error(err);
      return undefined as string | undefined;
    });
  }
}

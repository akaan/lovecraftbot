import * as fs from "fs";
import * as util from "util";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";
import { BaseService } from "../base/BaseService";
import { LoggerService } from "./LoggerService";
import { Guild } from "discord.js";

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const exists = util.promisify(fs.exists);
const mkdir = util.promisify(fs.mkdir);

@Singleton
@OnlyInstantiableByContainer
export class ResourcesService extends BaseService {
  @Inject private logger!: LoggerService;

  public resourceExists(filename: string): Promise<boolean> {
    return exists(`./data/${filename}`);
  }

  public readResource(filename: string): Promise<string | undefined> {
    return readFile(`./data/${filename}`, "utf-8").catch((err) => {
      this.logger.error(err);
      return undefined as string | undefined;
    });
  }

  public saveResource(filename: string, content: string): Promise<void> {
    return writeFile(`./data/${filename}`, content).catch((err) => {
      this.logger.error(err);
    });
  }

  public guildResourceExists(guild: Guild, filename: string): Promise<boolean> {
    return ResourcesService.createGuildFolder(guild).then(() => {
      return exists(`./data/guild-${guild.id}/${filename}`);
    });
  }

  public readGuildResource(
    guild: Guild,
    filename: string
  ): Promise<string | undefined> {
    return ResourcesService.createGuildFolder(guild).then(() => {
      return readFile(`./data/guild-${guild.id}/${filename}`, "utf-8").catch(
        (err) => {
          this.logger.error(err);
          return undefined as string | undefined;
        }
      );
    });
  }

  public saveGuildResource(
    guild: Guild,
    filename: string,
    content: string
  ): Promise<void> {
    return ResourcesService.createGuildFolder(guild).then(() => {
      return writeFile(`./data/guild-${guild.id}/${filename}`, content).catch(
        (err) => {
          this.logger.error(err);
        }
      );
    });
  }

  private static async createGuildFolder(guild: Guild): Promise<void> {
    try {
      return await mkdir(`./data/guild-${guild.id}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") {
        return Promise.resolve();
      } else {
        return Promise.reject();
      }
    }
  }
}

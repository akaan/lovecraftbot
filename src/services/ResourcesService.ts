import * as fs from "fs";
import * as util from "util";

import { Guild } from "discord.js";
import { OnlyInstantiableByContainer, Singleton, Inject } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

import { LoggerService } from "./LoggerService";

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const exists = util.promisify(fs.exists);
const mkdir = util.promisify(fs.mkdir);

@Singleton
@OnlyInstantiableByContainer
export class ResourcesService extends BaseService {
  private static LOG_LABEL = "ResourcesService";

  @Inject private logger!: LoggerService;

  public resourceExists(filename: string): Promise<boolean> {
    return exists(`./data/${filename}`);
  }

  public readResource(filename: string): Promise<string | undefined> {
    return readFile(`./data/${filename}`, "utf-8").catch((error) => {
      this.logger.error(
        ResourcesService.LOG_LABEL,
        `Erreur à la lecture du fichier ${filename}`,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { error }
      );
      return undefined as string | undefined;
    });
  }

  public saveResource(filename: string, content: string): Promise<void> {
    return writeFile(`./data/${filename}`, content).catch((error) => {
      this.logger.error(
        ResourcesService.LOG_LABEL,
        `Erreur à l'écriture du fichier ${filename}`,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { error }
      );
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
        (error) => {
          this.logger.error(
            ResourcesService.LOG_LABEL,
            `Erreur à la lecture du fichier ${filename} pour le serveur ${guild.name}`,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            { error }
          );
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
        (error) => {
          this.logger.error(
            ResourcesService.LOG_LABEL,
            `Erreur à l'écriture du fichier ${filename} pour le serveur ${guild.name}`,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            { error }
          );
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

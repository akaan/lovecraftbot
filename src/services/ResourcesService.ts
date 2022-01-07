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
/**
 * Service de gestion des ressources sur le système de fichiers.
 */
export class ResourcesService extends BaseService {
  /** Etiquette utilisée pour les logs de ce service */
  private static LOG_LABEL = "ResourcesService";

  @Inject private logger!: LoggerService;

  /**
   * Indique si la ressource précisée existe au global.
   *
   * @param filename Le nom du fichier
   * @returns Une promesse résolue avec vrai si la ressource existe
   */
  public resourceExists(filename: string): Promise<boolean> {
    return exists(`./data/${filename}`);
  }

  /**
   * Lit un fichier global.
   *
   * @param filename Le nom du fichier
   * @returns Une promesse résolue avec le contenu du fichier si disponible
   */
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

  /**
   * Ecrit le contenu fourni (annule et remplace) dans le fichier global
   * précisé.
   *
   * @param filename Le nom du fichier
   * @param content Le contenu à inscrire dans le fichier
   * @returns Une promesse résolue une fois l'écriture terminée
   */
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

  /**
   * Indique si le fichier indiqué existe pour le serveur indiqué.
   *
   * @param guild Le serveur concerné
   * @param filename Le nom du fichier
   * @returns Une promesse résolue avec vai si le fichier existe
   */
  public guildResourceExists(guild: Guild, filename: string): Promise<boolean> {
    return ResourcesService.createGuildFolder(guild).then(() => {
      return exists(`./data/guild-${guild.id}/${filename}`);
    });
  }

  /**
   * Lit le fichier indiqué pour le serveur indique.
   *
   * @param guild Le serveur concerné
   * @param filename Le nom du fichier
   * @returns Une promesse résolue avec le contenu du fichier si disponible
   */
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

  /**
   * Ecrit le contenu fourni (annule et remplace) dans le fichier précisé et
   * pour le serveur précisé.
   *
   * @param guild Le serveur concerné
   * @param filename Le nom du fichier
   * @param content Le contenu à écrire dans le fichier
   * @returns Une promesse résolue une fois l'écriture terminée
   */
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

  /**
   * Créé, si nécessaire, le dossier qui contiendra les fichiers d'un serveur
   * donné.
   *
   * @param guild Le serveur concerné
   * @returns Une promesse résolue une fois le dossier créé
   */
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

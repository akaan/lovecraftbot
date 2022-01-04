/* eslint-disable no-console */
import * as Discord from "discord.js";
import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

type Metadata = { [key: string]: unknown };

@Singleton
@OnlyInstantiableByContainer
/**
 * Service permettant de tracer des événements dans l'exécution du code.
 */
export class LoggerService extends BaseService {
  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);
    this.watchGlobalUncaughtExceptions();
  }

  /**
   * Permet de tracer un message de niveau erreur.
   *
   * @param label L'étiquette de cette trace
   * @param message Le message à tracer
   * @param meta Métadonnées associées à la trace
   */
  public error(label: string, message: string, meta?: Metadata): void {
    if (meta) {
      console.error(this.timeStamp(), label, message, meta);
    } else {
      console.error(this.timeStamp(), label, message);
    }
  }

  /**
   * Permet de tracer un message de niveau avertissement.
   *
   * @param label L'étiquette de cette trace
   * @param message Le message à tracer
   * @param meta Métadonnées associées à la trace
   */
  public warn(label: string, message: string, meta?: Metadata): void {
    if (meta) {
      console.warn(this.timeStamp(), label, message, meta);
    } else {
      console.warn(this.timeStamp(), label, message);
    }
  }

  /**
   * Permet de tracer un message de niveau information.
   *
   * @param label L'étiquette de cette trace
   * @param message Le message à tracer
   * @param meta Métadonnées associées à la trace
   */
  public info(label: string, message: string, meta?: Metadata): void {
    if (meta) {
      console.info(this.timeStamp(), label, message, meta);
    } else {
      console.info(this.timeStamp(), label, message);
    }
  }

  /**
   * Permet de tracer un message de niveau debug.
   *
   * @param label L'étiquette de cette trace
   * @param message Le message à tracer
   * @param meta Métadonnées associées à la trace
   */
  public debug(label: string, message: string, meta?: Metadata): void {
    if (meta) {
      console.debug(this.timeStamp(), label, message, meta);
    } else {
      console.debug(this.timeStamp(), label, message);
    }
  }

  /**
   * Retourne la date courante pour utilisation dans les traces.
   * @returns La date courante
   */
  private timeStamp() {
    return new Date();
  }

  /**
   * Installe une écoute sur les exceptions non attrapées.
   */
  private watchGlobalUncaughtExceptions() {
    process.on("uncaughtException", (err) => {
      this.error("ROOT", "Exception non attrapée", { error: err });
      process.exit(0);
    });
  }
}

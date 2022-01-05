import { Client } from "discord.js";
import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";
import { getLogger } from "../getLogger";

type Metadata = { [key: string]: unknown };

@Singleton
@OnlyInstantiableByContainer
/**
 * Service permettant de tracer des événements dans l'exécution du code.
 */
export class LoggerService extends BaseService {
  /** Logger */
  private rootLogger = getLogger();

  public async init(client: Client): Promise<void> {
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
    this.rootLogger.error({ label, message, metadata: meta });
  }

  /**
   * Permet de tracer un message de niveau avertissement.
   *
   * @param label L'étiquette de cette trace
   * @param message Le message à tracer
   * @param meta Métadonnées associées à la trace
   */
  public warn(label: string, message: string, meta?: Metadata): void {
    this.rootLogger.warn({ label, message, metadata: meta });
  }

  /**
   * Permet de tracer un message de niveau information.
   *
   * @param label L'étiquette de cette trace
   * @param message Le message à tracer
   * @param meta Métadonnées associées à la trace
   */
  public info(label: string, message: string, meta?: Metadata): void {
    this.rootLogger.info({ label, message, metadata: meta });
  }

  /**
   * Permet de tracer un message de niveau debug.
   *
   * @param label L'étiquette de cette trace
   * @param message Le message à tracer
   * @param meta Métadonnées associées à la trace
   */
  public debug(label: string, message: string, meta?: Metadata): void {
    this.rootLogger.debug({ label, message, metadata: meta });
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

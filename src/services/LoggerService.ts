import { Client } from "discord.js";
import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";
import winston from "winston";

import { BaseService } from "../base/BaseService";

type Metadata = { [key: string]: unknown };

@Singleton
@OnlyInstantiableByContainer
/**
 * Service permettant de tracer des événements dans l'exécution du code.
 */
export class LoggerService extends BaseService {
  /** Logger racine winston */
  private rootLogger = winston.createLogger({
    level: "debug",
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf((info) => {
            const parts = [
              yellow(info.timestamp as string),
              green((info.label as string).padEnd(30)),
              info.level === "error"
                ? red(info.level.padEnd(8))
                : blue(info.level.padEnd(8)),
              info.message,
            ];

            if (info.metadata) {
              const metadata = info.metadata as { [key: string]: unknown };
              if (metadata.error && metadata.error instanceof Error) {
                const error = metadata.error;
                delete metadata.error;
                if (Object.keys(metadata).length !== 0)
                  parts.push(JSON.stringify(metadata));
                parts.push("\n");
                parts.push(error.stack || error.message);
              } else {
                parts.push(JSON.stringify(info.metadata));
              }
            }

            return parts.join(" ");
          })
        ),
      }),
    ],
  });

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

/** Remise à zéro de la couleur dans le terminal. */
const ColorReset = "\x1b[0m";

/** Texte en rouge dans le terminal. */
const ColorFgRed = "\x1b[31m";

/** Texte en vert dans le terminal. */
const ColorFgGreen = "\x1b[32m";

/** Texte en jaune dans le terminal. */
const ColorFgYellow = "\x1b[33m";

/** Texte en bleu dans le terminal. */
const ColorFgBlue = "\x1b[34m";

/**
 * Renvoie une fonction qui renverra le message fourni encadré par les codes
 * permettant de positionner la couleur puis de remettre la couleur par défaut.
 *
 * @param color Le code permettant d'appliquer la couleur dans le terminal
 * @returns Une fonction qui applique la couleur au message fourni
 */
const colorize = (color: string) => (msg: string) =>
  `${color}${msg}${ColorReset}`;

/**
 * Colore le texte en jaune.
 *
 * @param msg Le texte à colorier
 */
const yellow = colorize(ColorFgYellow);

/**
 * Colore le texte en rouge.
 *
 * @param msg Le texte à colorier
 */
const red = colorize(ColorFgRed);

/**
 * Colore le texte en bleu.
 *
 * @param msg Le texte à colorier
 */
const blue = colorize(ColorFgBlue);

/**
 * Colore le texte en vert.
 *
 * @param msg Le texte à colorier
 */
const green = colorize(ColorFgGreen);

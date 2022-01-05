import winston from "winston";

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

function templateFunction(info: winston.Logform.TransformableInfo): string {
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
}

/**
 * Renvoie le logger configuré pour l'application.
 *
 * @returns Le logger
 */
export function getLogger(): winston.Logger {
  return winston.createLogger({
    level: "debug",
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(templateFunction)
        ),
      }),
    ],
  });
}

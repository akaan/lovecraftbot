import { Client, Intents } from "discord.js";
import * as dotenv from "dotenv";
import { Container } from "typescript-ioc";

import { ApplicationCommandManager } from "../src/services/ApplicationCommandManager";
import { LoggerService } from "../src/services/LoggerService";

const main = async () => {
  dotenv.config();

  const LOG_LABEL = "registerApplicationCommands";
  const logger = Container.get(LoggerService);

  const client = new Client({
    intents: [
      Intents.FLAGS.GUILDS,
      Intents.FLAGS.GUILD_MESSAGES,
      Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    ],
  });

  client.on("ready", async () => {
    logger.info(LOG_LABEL, "Connecté");

    const applicationCommandManager = Container.get(ApplicationCommandManager);
    try {
      await applicationCommandManager.init(client);
      logger.info(LOG_LABEL, "Enregistrement des commandes d'application...");
      await applicationCommandManager.registerApplicationCommands();
      logger.info(LOG_LABEL, "Commandes d'application enregistrées");
      logger.info(
        LOG_LABEL,
        "Mise en place des permissions pour les commandes serveur"
      );
      await applicationCommandManager.setGuildApplicationCommandsPermissions();
      logger.info(
        LOG_LABEL,
        "Permissions pour les commandes serveur mises en place"
      );
    } catch (error) {
      logger.error(LOG_LABEL, "Erreur à l'enregistrement des commandes", {
        error,
      });
    }

    client.destroy();
  });

  await client.login(process.env.DISCORD_TOKEN);
};

main().catch((err) => console.log(err));

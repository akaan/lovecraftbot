import { Client, Intents } from "discord.js";
import * as dotenv from "dotenv";
import { Container } from "typescript-ioc";

import { ApplicationCommandManager } from "../src/services/ApplicationCommandManager";
import { LoggerService } from "../src/services/LoggerService";

const main = async () => {
  dotenv.config();

  const LOG_LABEL = "unregisterApplicationCommands";
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
      logger.info(
        LOG_LABEL,
        "Désenregistrement des commandes d'application..."
      );
      await applicationCommandManager.unregisterApplicationCommands();
      logger.info(LOG_LABEL, "Commandes d'application désenregistrées");
    } catch (error) {
      logger.error(LOG_LABEL, "Erreur au désenregistrement des commandes", {
        error,
      });
    }

    client.destroy();
  });

  await client.login(process.env.DISCORD_TOKEN);
};

main().catch((err) => console.log(err));

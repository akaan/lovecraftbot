import { Client, Intents } from "discord.js";
import * as dotenv from "dotenv";
import { Container } from "typescript-ioc";

import { ApplicationCommandManager } from "../src/services/ApplicationCommandManager";
import { LoggerService } from "../src/services/LoggerService";

const main = async () => {
  dotenv.config();

  const logger = Container.get(LoggerService);

  const client = new Client({
    intents: [
      Intents.FLAGS.GUILDS,
      Intents.FLAGS.GUILD_MESSAGES,
      Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    ],
  });

  client.on("ready", async () => {
    console.log("Connected");

    const applicationCommandManager = Container.get(ApplicationCommandManager);
    try {
      await applicationCommandManager.init(client);
      logger.log("Unregistering application commands...");
      await applicationCommandManager.unregisterApplicationCommands();
      logger.log("Application commands unregistered");
    } catch (err) {
      logger.error(err);
    }

    client.destroy();
  });

  await client.login(process.env.DISCORD_TOKEN);
};

main().catch((err) => console.log(err));

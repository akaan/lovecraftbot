import { Client, Intents } from "discord.js";
import * as dotenv from "dotenv";
import { Container } from "typescript-ioc";

import { LoggerService } from "../src/services/LoggerService";
import { SlashCommandManager } from "../src/services/SlashCommandManager";

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
    logger.log("Connected");

    const slashCommandManager = Container.get(SlashCommandManager);
    try {
      await slashCommandManager.init(client);
      logger.log("Registering slash commands...");
      await slashCommandManager.registerSlashCommands();
      logger.log("Slash commands registered");
      logger.log("Setting up guild commands permissions");
      await slashCommandManager.setSlashCommandPermissions();
      logger.log("Guild commands permissions set");
    } catch (err) {
      logger.error(err);
    }

    client.destroy();
  });

  await client.login(process.env.DISCORD_TOKEN);
};

main().catch((err) => console.log(err));

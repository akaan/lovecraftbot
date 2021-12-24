import { Client, Intents } from "discord.js";
import * as dotenv from "dotenv";

const main = async () => {
  dotenv.config();

  const client = new Client({
    intents: [
      Intents.FLAGS.GUILDS,
      Intents.FLAGS.GUILD_MESSAGES,
      Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    ],
  });

  client.on("ready", async () => {
    console.log("Connected");

    if (client.application) {
      console.log("Unregistering global commands");
      await client.application.commands.set([]);
      console.log("Global commands unregistered");
    }
    await Promise.all(
      client.guilds.cache.map((guild) => {
        console.log(`Unregistering commands in Guild ${guild.name}`);
        return guild.commands
          .set([])
          .then(() => guild.commands.permissions.set({ fullPermissions: [] }));
      })
    );
    console.log("Guild commands unregistered");

    client.destroy();
  });

  await client.login(process.env.DISCORD_TOKEN);
};

main().catch((err) => console.log(err));

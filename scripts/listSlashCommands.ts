import { Client, Intents } from "discord.js";
import * as dotenv from "dotenv";

type GuildCommands = { [guildName: string]: string[] };

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
      const globalCommands = await client.application.commands.fetch();
      console.log("Global commands:");
      console.log(globalCommands.map((command) => command.name).join("\n"));
    }

    const guildCommands = await client.guilds.cache.reduce(
      async (acc, guild) => {
        const commands = await guild.commands.fetch();
        (await acc)[guild.name] = commands.map((command) => command.name);
        return acc;
      },
      Promise.resolve({}) as Promise<GuildCommands>
    );

    for (const [guildName, commandNames] of Object.entries(guildCommands)) {
      console.log(`Commands in guild ${guildName}:`);
      console.log(commandNames.join("\n"));
    }

    client.destroy();
  });

  await client.login(process.env.DISCORD_TOKEN);
};

main().catch((err) => console.log(err));

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import * as dotenv from "dotenv";
import { Container } from "typescript-ioc";
dotenv.config();

import { Bot } from "./Bot";

const init = async () => {
  const bot = Container.get(Bot);

  try {
    await bot.init();
    process.on("SIGINT", () => {
      bot.shutdown();
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);

    process.exit(0);
  }
};

init().catch((err) => console.error(err));

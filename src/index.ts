/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import * as dotenv from "dotenv";
dotenv.config();

import { Bot } from "./Bot";

const init = async () => {
  const bot = new Bot();

  try {
    await bot.init();
    process.on("SIGINT", () => {
      bot
        .shutdown()
        .then(() => process.exit(0))
        .catch((err) => console.error(err));
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);

    process.exit(0);
  }
};

init().catch((err) => console.error(err));

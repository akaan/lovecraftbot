import * as Discord from "discord.js";
import { Inject } from "typescript-ioc";

import { ICommand } from "../interfaces";
import { EmojiService } from "../services/EmojiService";

/** Ecouteur pour celui dont on ne doit pas prononcer le nom */
export class HasturCommand implements ICommand {
  aliases = undefined;
  help = "Il ne faut pas prononcer son nom";

  @Inject private emojiService!: EmojiService;

  async onMessage(message: Discord.Message): Promise<void> {
    if (/hastur/i.test(message.content)) {
      const hastur = this.emojiService.getEmoji("yellow");
      const emoji = hastur || "🐙";
      await message.reply(
        `tu as attiré celui dont il ne faut pas prononcer le nom.`
      );
      await message.reply(`${emoji}`);
    }
  }
}

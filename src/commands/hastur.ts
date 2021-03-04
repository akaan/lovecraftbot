import * as Discord from "discord.js";
import { ICommand } from "../interfaces";
import { Inject } from "typescript-ioc";
import { EmojiService } from "../services/emoji";

export class HasturCommand implements ICommand {
  @Inject private emojiService: EmojiService;

  help = "Il ne faut pas prononcer son nom";

  aliases = null;

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

import * as Discord from "discord.js";
import { ICommand } from "../interfaces";
import { Inject } from "typescript-ioc";
import { EmojiService } from "../services/EmojiService";

export class HasturCommand implements ICommand {
  aliases = undefined;
  help = "Il ne faut pas prononcer son nom";

  constructor(@Inject private emojiService: EmojiService) {}

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

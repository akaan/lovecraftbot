import * as Discord from "discord.js";

import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";
import { BaseService } from "../base/BaseService";

@Singleton
@OnlyInstantiableByContainer
export class EmojiService extends BaseService {
  private emojiHash: { [key: string]: string } = {};
  private emojiInstanceHash: { [key: string]: Discord.Emoji } = {};

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);

    this.loadEmojis();
  }

  public getEmoji(name: string): string {
    return this.emojiHash[name];
  }

  public getEmojiInstance(name: string): Discord.Emoji {
    return this.emojiInstanceHash[name];
  }

  private loadEmojis(): void {
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-explicit-any */
    const emojiCollection = this.client.emojis.cache as any;

    /* eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
    emojiCollection.forEach((emoji: Discord.Emoji) => {
      this.emojiHash[emoji.name] = emoji.toString();
      this.emojiInstanceHash[emoji.name] = emoji;
    });
  }
}

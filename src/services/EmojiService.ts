import * as Discord from "discord.js";
import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

@Singleton
@OnlyInstantiableByContainer
/**
 * Service permettant au bot d'afficher des Emojis.
 */
export class EmojiService extends BaseService {
  private emojiHash: { [key: string]: string } = {};
  private emojiInstanceHash: { [key: string]: Discord.Emoji } = {};

  public async init(client: Discord.Client): Promise<void> {
    await super.init(client);
    this.loadEmojis();
  }

  /**
   * Récupère le texte à envoyer dans un message pour afficher l'Emoji
   * correspondant au code fourni.
   *
   * @param name Le code de l'Emoji
   * @returns Le texte qui sera transcrit en Emoji une fois envoyé dans un
   *          message
   */
  public getEmoji(name: string): string {
    return this.emojiHash[name];
  }

  /**
   * Récupère l'instance d'un Emoji via son code.
   *
   * @param name Le code de l'Emoji
   * @returns L'instance de l'Emoji
   */
  public getEmojiInstance(name: string): Discord.Emoji {
    return this.emojiInstanceHash[name];
  }

  /**
   * Charge les Emojis depuis le cache du client Discord.
   */
  private loadEmojis(): void {
    if (!this.client) {
      return;
    }

    /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-explicit-any */
    const emojiCollection = this.client.emojis.cache as any;

    /* eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
    emojiCollection.forEach((emoji: Discord.Emoji) => {
      if (emoji.name) {
        this.emojiHash[emoji.name] = emoji.toString();
        this.emojiInstanceHash[emoji.name] = emoji;
      }
    });
  }
}

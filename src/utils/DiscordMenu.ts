import * as Discord from "discord.js";
import { LoggerService } from "../services/LoggerService";
import { Inject } from "typescript-ioc";

export class DiscordMenu {
  @Inject private logger?: LoggerService;
  private currentPage = 0;
  private sentMessage?: Discord.Message;
  private reactions = {
    first: "⏪",
    back: "◀",
    next: "▶",
    last: "⏩",
    stop: "⏹",
  };

  constructor(private pages: Discord.MessageEmbed[]) {
    this.pages = pages;
  }

  public async replyTo(msg: Discord.Message): Promise<Discord.Message> {
    this.sentMessage = await msg.channel.send({
      embeds: [this.pages[this.currentPage]],
    });
    await this.addReactions();
    this.createCollector();
    return this.sentMessage;
  }

  private async select(page = 0) {
    if (!this.sentMessage) {
      return;
    }
    this.currentPage = page;
    await this.sentMessage.edit({ embeds: [this.pages[page]] });
  }

  private createCollector() {
    if (!this.sentMessage) {
      return;
    }
    const collector = this.sentMessage.createReactionCollector({
      time: 120000,
    });

    collector.on(
      "collect",
      (reaction: Discord.MessageReaction, user: Discord.User) => {
        if (reaction.emoji.name == this.reactions.first) {
          if (this.currentPage != 0)
            this.select(0).catch(
              (err) => this.logger && this.logger.error(err)
            );
        } else if (reaction.emoji.name == this.reactions.back) {
          if (this.currentPage != 0)
            this.select(this.currentPage - 1).catch(
              (err) => this.logger && this.logger.error(err)
            );
        } else if (reaction.emoji.name == this.reactions.next) {
          if (this.currentPage < this.pages.length - 1)
            this.select(this.currentPage + 1).catch(
              (err) => this.logger && this.logger.error(err)
            );
        } else if (reaction.emoji.name == this.reactions.last) {
          if (this.currentPage != this.pages.length)
            this.select(this.pages.length - 1).catch(
              (err) => this.logger && this.logger.error(err)
            );
        } else if (reaction.emoji.name == this.reactions.stop) collector.stop();
        reaction.users
          .remove(user)
          .catch((err) => this.logger && this.logger.error(err));
      }
    );

    collector.on("end", () => {
      if (this.sentMessage) {
        this.sentMessage.reactions
          .removeAll()
          .catch((err) => this.logger && this.logger.error(err));
      }
    });
  }

  private async addReactions() {
    if (!this.sentMessage) {
      return;
    }

    await this.sentMessage.react(this.reactions.first);
    await this.sentMessage.react(this.reactions.back);
    await this.sentMessage.react(this.reactions.next);
    await this.sentMessage.react(this.reactions.last);
    await this.sentMessage.react(this.reactions.stop);
  }
}

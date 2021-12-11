import {
  CommandInteraction,
  Message,
  MessageActionRow,
  MessageSelectMenu,
  SelectMenuInteraction,
} from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { Inject } from "typescript-ioc";

import { ISlashCommand, ISlashCommandResult } from "../interfaces";
import { ArkhamDBCard, CardService, SearchType } from "../services/CardService";

interface SearchOptions {
  xp: "none" | "all" | number;
  extended: boolean;
  back: boolean;
  searchType: SearchType;
  searchString: string;
}

export class CardCommand implements ISlashCommand {
  @Inject private cardService!: CardService;

  isAdmin = false;
  name = "carte";
  description = `Pour l'affichage de carte(s)`;
  options = [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "recherche",
      description:
        "Code de la carte ou texte à chercher dans le titre de la carte",
      required: true,
    },
    {
      type: ApplicationCommandOptionTypes.INTEGER,
      name: "xp",
      description:
        "Le niveau d'XP de la carte recherchée ou '0' pour chercher tous les niveaux de la carte",
      required: false,
    },
    {
      type: ApplicationCommandOptionTypes.BOOLEAN,
      name: "complet",
      description:
        "Pour envoyer une description complète de la carte (et non seulement l'image)",
      required: false,
    },
    {
      type: ApplicationCommandOptionTypes.BOOLEAN,
      name: "dos",
      description: "Pour envoyer le dos de la carte",
      required: false,
    },
  ];

  private CARD_CODE_REGEX = /(\d{5})(b?)$/;

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<ISlashCommandResult> {
    const search = commandInteraction.options.getString("recherche");
    const xp = commandInteraction.options.getInteger("xp");
    const extended = commandInteraction.options.getBoolean("complet") || false;
    const back = commandInteraction.options.getBoolean("dos") || false;

    if (search) {
      const searchOptions: SearchOptions = {
        xp: xp !== null ? (xp === 0 ? "all" : xp) : "none",
        extended,
        back,
        searchType: this.CARD_CODE_REGEX.test(search)
          ? SearchType.BY_CODE
          : SearchType.BY_TITLE,
        searchString: search,
      };

      let foundCards: ArkhamDBCard[] = [];
      foundCards = this.cardService.getCards({
        searchString: searchOptions.searchString,
        searchType: searchOptions.searchType,
        includeSameNameCards: searchOptions.xp !== "none",
      });

      if (typeof searchOptions.xp === "number") {
        foundCards = foundCards.filter((card) => card.xp === searchOptions.xp);
      }

      if (foundCards.length > 0) {
        if (foundCards.length === 1) {
          return this.sendCard(
            commandInteraction,
            foundCards[0],
            searchOptions
          );
        } else {
          return this.sendCardChoices(
            commandInteraction,
            foundCards,
            searchOptions
          );
        }
      } else {
        await commandInteraction.reply(
          "Désolé, le mystère de cette carte reste entier."
        );
        return {
          message: `[CardCommand] Aucune carte correspondant à la recherche ${search}`,
        };
      }
    } else {
      return { message: "[CardCommand] Texte recherché non fourni" };
    }
  }

  private async sendCard(
    interaction: CommandInteraction | SelectMenuInteraction,
    card: ArkhamDBCard,
    options: SearchOptions
  ): Promise<ISlashCommandResult> {
    const cardEmbed = await this.cardService.createEmbed(card, {
      back: options.back,
      extended: options.extended,
    });
    await interaction.reply({ embeds: [cardEmbed] });
    return { message: `[CardCommand] Carte envoyée` };
  }

  private async sendCardChoices(
    interaction: CommandInteraction,
    cards: ArkhamDBCard[],
    options: SearchOptions
  ): Promise<ISlashCommandResult> {
    const cardChoices = cards.map((card) => ({
      label: `${card.name}${card.xp ? ` (${card.xp})` : ""}`,
      value: card.code,
    }));

    const menuComponent = new MessageActionRow().addComponents([
      new MessageSelectMenu()
        .setCustomId("cardCode")
        .setPlaceholder("Choisissez une carte à afficher")
        .addOptions(cardChoices),
    ]);

    const menu = (await interaction.reply({
      content: `${cards.length} cartes correspondent à la recherche`,
      components: [menuComponent],
      ephemeral: true,
      fetchReply: true,
    })) as Message;

    const menuCollector = menu.createMessageComponentCollector({
      componentType: "SELECT_MENU",
      time: 15000,
    });

    const onSelect = async (selectMenuInteraction: SelectMenuInteraction) => {
      const cardCodeSelected = selectMenuInteraction.values[0];
      const cardToSend = cards.find((c) => c.code === cardCodeSelected);
      if (cardToSend) {
        await this.sendCard(selectMenuInteraction, cardToSend, options);
      } else {
        await selectMenuInteraction.reply(`Oups, il y a eu un problème`);
      }
    };

    menuCollector.on("collect", onSelect);

    return { message: `[CardCommand] Menu de sélection de carte envoyé` };
  }
}

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
  extended: boolean;
  back: boolean;
  searchType: SearchType;
  searchString: string;
  ephemeral: boolean;
}

export class CardCommand implements ISlashCommand {
  @Inject private cardService!: CardService;

  isAdmin = false;
  name = "c";
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
    {
      type: ApplicationCommandOptionTypes.BOOLEAN,
      name: "ephemere",
      description: "Si vrai, seul toi pourra voir la réponse",
      required: false,
    },
  ];

  private CARD_CODE_REGEX = /(\d{5})(b?)$/;

  async execute(
    commandInteraction: CommandInteraction
  ): Promise<ISlashCommandResult> {
    const search = commandInteraction.options.getString("recherche");
    const extended = commandInteraction.options.getBoolean("complet") || false;
    const back = commandInteraction.options.getBoolean("dos") || false;
    const ephemeral =
      commandInteraction.options.getBoolean("ephemere") || false;

    if (search) {
      const searchOptions: SearchOptions = {
        extended,
        back,
        searchType: this.CARD_CODE_REGEX.test(search)
          ? SearchType.BY_CODE
          : SearchType.BY_TITLE,
        searchString: search,
        ephemeral,
      };

      let foundCards: ArkhamDBCard[] = [];
      foundCards = this.cardService.getCards({
        searchString: searchOptions.searchString,
        searchType: searchOptions.searchType,
      });

      if (foundCards.length > 0) {
        if (foundCards.length === 1) {
          return this.sendCard(
            commandInteraction,
            foundCards[0],
            searchOptions
          );
        } else {
          if (commandInteraction.inGuild()) {
            return this.sendCardChoices(
              commandInteraction,
              foundCards,
              searchOptions
            );
          } else {
            await commandInteraction.reply(
              `Désolé mais ${foundCards.length} cartes correspondent à cette recherche et je ne sais pas encore te présenter un menu de sélection dans ce canal. Essaye d'être plus précis ou bien effectue cette commande sur un serveur.`
            );
            return {
              message: `[CardCommand] Demande de plusieurs carte hors serveur : pas possible`,
            };
          }
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
    await interaction.reply({
      embeds: [cardEmbed],
      ephemeral: options.ephemeral,
    });
    return { message: `[CardCommand] Carte envoyée` };
  }

  private async sendCardChoices(
    interaction: CommandInteraction,
    cards: ArkhamDBCard[],
    options: SearchOptions
  ): Promise<ISlashCommandResult> {
    const cardChoices = cards
      .map((card) => ({
        label: `${card.name}${card.xp ? ` (${card.xp})` : ""}${
          card.faction_code === "mythos" ? " (Mythe)" : ""
        }`,
        value: card.code,
      }))
      .slice(0, 25);

    const menuComponent = new MessageActionRow().addComponents([
      new MessageSelectMenu()
        .setCustomId("cardCode")
        .setPlaceholder("Choisissez une carte à afficher")
        .addOptions(cardChoices),
    ]);

    const menu = (await interaction.reply({
      content: `${cards.length} cartes correspondent à la recherche.${
        cards.length > 25
          ? " Je vous proposent seulement les 25 premières, essayez d'affiner votre recherche."
          : ""
      }`,
      components: [menuComponent],
      ephemeral: true,
      fetchReply: true,
    })) as Message;

    const menuCollector = menu.createMessageComponentCollector({
      componentType: "SELECT_MENU",
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

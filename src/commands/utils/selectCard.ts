import {
  CommandInteraction,
  Message,
  MessageActionRow,
  MessageSelectMenu,
  SelectMenuInteraction,
} from "discord.js";

import { createSelectMenuCollector } from "../../discordHelpers";
import { IApplicationCommandResult } from "../../interfaces";
import { ArkhamDBCard } from "../../services/CardService";

/**
 * Propose à l'utilisateur un choix parmi plusieurs cartes.
 *
 * @param commandName Le nom de la commande sollicitant ce choix de carte
 * @param interaction L'interaction déclenchée par la commande
 * @param cards La liste des cartes parmi lesquelles choisir
 * @param onCardSelected La fonction a appeler une fois la carte choisie
 * @returns Un résultat de commande
 */
export async function selectCard(
  commandName: string,
  interaction: CommandInteraction,
  cards: ArkhamDBCard[],
  onCardSelected: (
    selectMenuInteraction: SelectMenuInteraction,
    selectedCard: ArkhamDBCard
  ) => Promise<void>
): Promise<IApplicationCommandResult> {
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

  const menuCollector = await createSelectMenuCollector(menu, interaction);

  const onSelect = async (selectMenuInteraction: SelectMenuInteraction) => {
    const cardCodeSelected = selectMenuInteraction.values[0];
    const cardToSend = cards.find((c) => c.code === cardCodeSelected);
    if (cardToSend) {
      await onCardSelected(selectMenuInteraction, cardToSend);
    } else {
      await selectMenuInteraction.reply({
        content: `Oups, il y a eu un problème`,
        ephemeral: true,
      });
    }
    if (menuCollector) menuCollector.stop();
  };

  if (menuCollector) {
    menuCollector.on("collect", onSelect);
    return {
      cmd: commandName,
      result: `Menu de sélection de carte envoyé`,
    };
  } else {
    await interaction.editReply({
      content:
        "Oups, je ne sais pas te proposer un choix de carte dans ce canal.",
      components: [],
    });
    return {
      cmd: commandName,
      result: `Impossible d'envoyer un menu de sélection de carte`,
    };
  }
}

import {
  CommandInteraction,
  InteractionCollector,
  Message,
  SelectMenuInteraction,
} from "discord.js";

/**
 * Permet de créer un collecteur d'interaction suite à l'envoi d'un message
 * contenant un composant de sélection.
 * Cette fonction gère le cas d'une interaction par canal privé pour lequel
 * il n'est pas possible de créer le collecteur directement depuis le message.
 *
 * @param message Le message qui contient de le composant de sélection
 * @param interaction L'interaction en cours de traitement
 * @returns Un collecteur d'interaction ou `undefined` s'il n'a pas pu être créé
 */
export async function createSelectMenuCollector(
  message: Message,
  interaction: CommandInteraction
): Promise<InteractionCollector<SelectMenuInteraction> | undefined> {
  if (message.createMessageComponentCollector) {
    return message.createMessageComponentCollector({
      componentType: "SELECT_MENU",
    });
  } else {
    // Ici on est dans le cas d'un message hors serveur
    const channelId = interaction.channelId;
    const channel = await interaction.client.channels.fetch(channelId);
    if (channel && channel.isText()) {
      return channel.createMessageComponentCollector({
        componentType: "SELECT_MENU",
      });
    }
  }
}

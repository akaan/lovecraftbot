import {
  CommandInteraction,
  InteractionCollector,
  Message,
  EmbedBuilder,
  SelectMenuInteraction,
  ComponentType,
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
      componentType: ComponentType.SelectMenu,
    });
  } else {
    // Ici on est dans le cas d'un message hors serveur
    const channelId = interaction.channelId;
    const channel = await interaction.client.channels.fetch(channelId);
    if (channel && channel.isTextBased()) {
      return channel.createMessageComponentCollector({
        componentType: ComponentType.SelectMenu,
      });
    }
  }
}

/**
 * Afin de s'assurer qu'un encart Discord n'est pas trop gros.
 * https://discord.com/developers/docs/resources/channel#embed-limits
 *
 * @param embed L'encart à mesurer
 * @returns La taille totale de l'encart
 */
export function getEmbedSize(embed: EmbedBuilder): number {
  const { title, description, author, footer, fields } = embed.data;

  const titleLength = title ? title.length : 0;
  const descriptionLength = description ? description.length : 0;
  const authorNameLength = author && author.name ? author.name.length : 0;
  const footerLength = footer && footer.text ? footer.text.length : 0;
  const fieldsLength = fields
    ? fields.reduce((sum, field) => {
        return sum + field.name.length + field.value.length;
      }, 0)
    : 0;

  return (
    titleLength +
    descriptionLength +
    authorNameLength +
    footerLength +
    fieldsLength
  );
}

import { CommandInteraction, EmbedFieldData, MessageEmbed } from "discord.js";
import { Container } from "typescript-ioc";

import { IApplicationCommand, IApplicationCommandResult } from "../interfaces";
import { ApplicationCommandManager } from "../services/ApplicationCommandManager";

/** Commande d'affichage de l'aide du bot */
export class HelpCommand implements IApplicationCommand {
  isGuildCommand = false;
  name = "aide";
  description =
    "Affiche quelques informations sur ce bot et comment l'utiliser";

  async execute(
    interaction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    const applicationCommandManager = Container.get(ApplicationCommandManager);
    const commandDescriptions: EmbedFieldData[] = applicationCommandManager
      .getGlobalApplicationCommands()
      .map((command) => ({
        name: "/" + command.name,
        value: command.description,
      }));

    const embed = new MessageEmbed();
    embed.setTitle("Aide");
    embed.setDescription(`Bonjour ! Je suis à ton service sur ce Discord.

  Je peux t'aider à trouver des cartes, des points de règles, afficher des decks, etc.
  Ci-dessous mes commandes: `);
    embed.setFields([
      ...commandDescriptions,
      {
        name: "Version",
        value: "2.3.0",
        inline: true,
      },
      {
        name: "Auteur",
        value: "Akaan Qualrus",
        inline: true,
      },
    ]);

    await interaction.reply({ ephemeral: true, embeds: [embed] });
    return { cmd: "HelpCommand", result: "Aide envoyée" };
  }
}

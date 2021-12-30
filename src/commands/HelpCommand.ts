import { CommandInteraction, EmbedFieldData, MessageEmbed } from "discord.js";
import { Container } from "typescript-ioc";

import { ISlashCommand, ISlashCommandResult } from "../interfaces";
import { SlashCommandManager } from "../services/SlashCommandManager";

export class HelpCommand implements ISlashCommand {
  isAdmin = false;
  name = "aide";
  description =
    "Affiche quelques informations sur ce bot et comment l'utiliser";

  async execute(interaction: CommandInteraction): Promise<ISlashCommandResult> {
    const slashCommandManager = Container.get(SlashCommandManager);
    const commandDescriptions: EmbedFieldData[] = slashCommandManager
      .getNonAdminCommands()
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
        value: "2.0.0",
        inline: true,
      },
      {
        name: "Auteur",
        value: "Akaan Qualrus",
        inline: true,
      },
    ]);

    await interaction.reply({ ephemeral: true, embeds: [embed] });
    return { message: "[HelpCommand] Aide envoyée" };
  }
}

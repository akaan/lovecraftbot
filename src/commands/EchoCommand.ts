import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { ISlashCommand, ISlashCommandResult } from "../interfaces";

export class EchoCommand implements ISlashCommand {
  isAdmin = false;
  data = new SlashCommandBuilder()
    .setName("echo")
    .setDescription("Retourne ton propre message")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Le message à renvoyer")
        .setRequired(true)
    ) as SlashCommandBuilder;

  async execute(interaction: CommandInteraction): Promise<ISlashCommandResult> {
    const message = interaction.options.getString("message");
    await interaction.reply(message || "");
    return { message: "EchoCommand: echoed message back to user" };
  }
}

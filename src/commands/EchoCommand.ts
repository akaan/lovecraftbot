import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { ISlashCommand, ISlashCommandResult } from "../interfaces";

export class EchoCommand implements ISlashCommand {
  isAdmin = false;
  data = new SlashCommandBuilder()
    .setName("echo")
    .setDescription("Retourne ton propre message");

  async execute(interaction: CommandInteraction): Promise<ISlashCommandResult> {
    await interaction.reply("Ohohoho");
    return { message: "DONE" };
  }
}

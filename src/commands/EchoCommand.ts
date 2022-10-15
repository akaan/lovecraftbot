import { CommandInteraction, SlashCommandBuilder } from "discord.js";

import {
  ApplicationCommandAccess,
  IApplicationCommand,
  IApplicationCommandResult,
} from "../interfaces";

/** Commande permettant de répéter à l'utilisateur son propre message */
export class EchoCommand implements IApplicationCommand {
  commandAccess = ApplicationCommandAccess.GLOBAL;

  commandData = new SlashCommandBuilder()
    .setName("echo")
    .setDescription("Retourne ton propre message")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Le message à renvoyer")
        .setRequired(true)
    );

  async execute(
    interaction: CommandInteraction
  ): Promise<IApplicationCommandResult> {
    if (!interaction.isChatInputCommand()) {
      await interaction.reply("Oups, y'a eu un problème");
      return { cmd: "EchoCommand", result: "Interaction hors chat" };
    }

    const message = interaction.options.getString("message");
    await interaction.reply(message || "");
    return {
      cmd: "EchoCommand",
      result: "Renvoie de son propre message à l'utilisateur",
    };
  }
}

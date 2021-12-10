import { CommandInteraction } from "discord.js";
// eslint-disable-next-line import/no-unresolved
import { ApplicationCommandOptionTypes } from "discord.js/typings/enums";
import { ISlashCommand, ISlashCommandResult } from "../interfaces";

export class EchoCommand implements ISlashCommand {
  isAdmin = false;
  name = "echo";
  description = "Retourne ton propre message";
  options = [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "message",
      description: "Le message à renvoyer",
      required: true,
    },
  ];

  async execute(interaction: CommandInteraction): Promise<ISlashCommandResult> {
    const message = interaction.options.getString("message");
    await interaction.reply(message || "");
    return { message: "EchoCommand: echoed message back to user" };
  }
}

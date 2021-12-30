import { CommandInteraction } from "discord.js";
import { Inject } from "typescript-ioc";

import { ISlashCommand, ISlashCommandResult } from "../interfaces";
import { EnvService } from "../services/EnvService";

export class InfoCommand implements ISlashCommand {
  @Inject private envService!: EnvService;

  isAdmin = false;
  name = "info";
  description = "Affiche quelques informations sur ce bot";

  async execute(interaction: CommandInteraction): Promise<ISlashCommandResult> {
    const infos = `Bonjour ! Je suis à ton service sur ce Discord.
Je peux t'aider à trouver des cartes, des points de règles, afficher des decks, etc.
La plupart de mes commandes sont disponibles en commençant à taper "/". Tu verras alors apparaître un menu pour t'aider.

Version: 2.0.0
Auteur: Akaan
Rôle pour les commandes Admin: ${this.envService.botAdminRoleName || "<aucun>"}
    `;

    await interaction.reply({ ephemeral: true, content: infos });
    return { message: "[InfoCommand] Informations envoyées" };
  }
}

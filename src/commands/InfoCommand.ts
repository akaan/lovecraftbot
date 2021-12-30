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
    const infos = `Je suis un bot pour Horreur à Arkham développé par Akaan.
La plupart de mes commandes sont disponibles en commençant à taper "/".

Version: 2.0.0
Rôle admin: ${this.envService.botAdminRoleName || "<aucun>"}
    `;

    await interaction.reply({ ephemeral: true, content: infos });
    return { message: "[InfoCommand] Informations envoyées" };
  }
}

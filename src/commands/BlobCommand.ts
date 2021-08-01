import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { Inject } from "typescript-ioc";
import { MassMultiplayerEventService } from "../services/MassMultiplayerEventService";
import { EnvService } from "../services/EnvService";
import { Guild, Message } from "discord.js";
import { BlobGameService } from "../services/BlobGameService";

export class BlobCommand implements ICommand {
  aliases = ["blob"];
  help = `Commandes pour gérer une partie massivement multijoueurs du **Dévoreur de Toute Chose**.

__Commandes pour les organisateurs__:

- \`admin start [nombre de joueurs] [nombre de groupes]\` pour démarrer une partie
  `;

  @Inject private blobGameService!: BlobGameService;
  @Inject private envService!: EnvService;
  @Inject private massMultiplayerEventService!: MassMultiplayerEventService;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message, args } = cmdArgs;

    if (!message.guild) {
      await message.reply(
        "désolé, cette commande n'est utilisable que sur un serveur."
      );
      return {
        resultString: `[BlobCommand] Impossible de traiter la commande en dehors d'un serveur.`,
      };
    }

    const massMultiplayerEventCategoryName =
      this.envService.massMultiplayerEventCategoryName;
    const massMultiplayerEventAdminChannelName =
      this.envService.massMultiplayerEventAdminChannelName;

    if (
      !massMultiplayerEventCategoryName ||
      !massMultiplayerEventAdminChannelName
    ) {
      await message.reply("désolé mais j'ai un problème de configuration.");
      return {
        resultString: `[BlobCommand] Impossible de traiter la commande en l'absence de configuration.`,
      };
    }

    const [subCmd, ...params] = args.split(" ");

    if (
      message.channel.type === "text" &&
      message.channel.parent &&
      message.channel.parent.name === massMultiplayerEventCategoryName
    ) {
      // COMMANDES ADMIN
      if (subCmd === "admin") {
        if (
          message.channel.type === "text" &&
          message.channel.name === massMultiplayerEventAdminChannelName
        ) {
          const [adminAction, ...adminActionParams] = params;

          if (adminAction === "start") {
            const [numberOfPlayers, numberOfGroups] = adminActionParams;
            if (
              numberOfPlayers &&
              !isNaN(parseInt(numberOfPlayers, 10)) &&
              numberOfGroups &&
              !isNaN(parseInt(numberOfGroups, 10))
            ) {
              return this.startGame(
                message.guild,
                massMultiplayerEventCategoryName,
                parseInt(numberOfPlayers, 10),
                parseInt(numberOfGroups, 10),
                message
              );
            }
          }
        }
      }

      // COMMANDES JOUEURS
      if (subCmd === "stats") {
        await message.reply(
          `Le Blob a ${
            this.blobGameService.getBlobRemainingHealth(message.guild) || 0
          } points de vie restants`
        );
        return {
          resultString: `[BlobCommand] Stats envoyées`,
        };
      }
    }

    await message.reply("désolé, je n'ai pas compris.");
    return { resultString: `[BlobCommand] Commande "${args}" non comprise.` };
  }

  private async startGame(
    guild: Guild,
    massMultiplayerEventCategoryName: string,
    numberOfPlayers: number,
    numberOfGroups: number,
    message: Message
  ): Promise<ICommandResult> {
    await this.massMultiplayerEventService.createGroupChannels(
      guild,
      massMultiplayerEventCategoryName,
      numberOfGroups
    );

    await this.blobGameService.startNewGame(guild, numberOfPlayers);

    await message.reply(
      `la partie est démarrée pour ${numberOfPlayers} joueurs répartis sur ${numberOfGroups} groupes !`
    );
    return {
      resultString: `[BlobCommand] Partie démarrée pour ${numberOfPlayers} joueurs répartis sur ${numberOfGroups} groupes`,
    };
  }
}

import { Channel, Guild, Message, TextChannel } from "discord.js";
import { Inject } from "typescript-ioc";

import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { BlobGameService } from "../services/BlobGameService";
import { LoggerService } from "../services/LoggerService";

export class BlobCommand implements ICommand {
  static LOG_LABEL = "BlobCommand";

  admin = true;
  aliases = ["blob"];
  help = `Commandes pour gérer une partie massivement multijoueurs du **Dévoreur de Toute Chose**.
Les sous-commandes sont décrites ci-dessous.

  __*Commandes pour les joueurs*__:
  - \`d [nombre de dégâts]\` inflige ce nombre de dégâts au Dévoreur
  - \`i [nombre d'indices]\` place ce nombre d'indices sur l'Acte 1
  - \`cm\` utilise une contre-mesures
  - \`cm+ \` ajoute une contre-mesures
  - \`story\` obtenir l'histoire retenue pour cette partie

  __*Commandes pour les organisateurs*__:
  - \`admin start [nombre de joueurs] [nombre de groupes]\` pour démarrer une partie
  - \`admin stats\` affiche les statistiques
  - \`admin end\` termine la partie
  - \`admin timer start [minutes]\` démarre une minuterie du nombre de minutes indiquées
  - \`admin timer pause\` met en pause la minuterie
  - \`admin timer resume\` reprend la mintuerie`;

  @Inject private blobGameService!: BlobGameService;
  @Inject private logger!: LoggerService;

  async execute(cmdArgs: ICommandArgs): Promise<ICommandResult> {
    const { message, args } = cmdArgs;

    try {
      if (!message.guild) {
        await message.reply(
          "désolé, cette commande n'est utilisable que sur un serveur."
        );
        return {
          resultString: `[BlobCommand] Impossible de traiter la commande en dehors d'un serveur.`,
        };
      }

      const [subCmd, ...params] = args.split(" ");
      if (subCmd === "admin" && params.length > 0) {
        return await this.handleAdminCommand(
          message.guild,
          message,
          params[0],
          params.slice(1)
        );
      } else {
        return await this.handlePlayerCommand(
          message.guild,
          message,
          subCmd,
          params
        );
      }
    } catch (error) {
      this.logger.error(
        BlobCommand.LOG_LABEL,
        "Erreur à l'exécution de la commande",
        { error }
      );
      await message.reply(`ouch, impossible : ${(error as Error).message}`);
      return {
        resultString: `[BlobCommand] Erreur: ${(error as Error).message}`,
      };
    }
  }

  private async handleAdminCommand(
    guild: Guild,
    message: Message,
    adminAction: string,
    adminActionParams: string[]
  ): Promise<ICommandResult> {
    if (this.blobGameService.isAdminChannel(message.channel as Channel)) {
      if (adminAction === "start") {
        const [numberOfPlayers, numberOfGroups] = adminActionParams;
        if (
          numberOfPlayers &&
          !isNaN(parseInt(numberOfPlayers, 10)) &&
          numberOfGroups &&
          !isNaN(parseInt(numberOfGroups, 10))
        ) {
          return await this.handleAdminStartCommand(
            guild,
            message,
            parseInt(numberOfPlayers, 10),
            parseInt(numberOfGroups, 10)
          );
        }
      }
      if (adminAction === "end") {
        return await this.handleAdminEndCommand(guild, message);
      }
      if (adminAction === "stats") {
        return await this.handleAdminStatsCommand(guild, message);
      }
      if (adminAction === "timer") {
        if (adminActionParams.length > 0) {
          return await this.handleAdminTimerCommand(
            guild,
            message,
            adminActionParams[0],
            adminActionParams.slice(1)
          );
        }
      }
    }
    return await this.handleUnknownCommand(message);
  }

  private async handleAdminStartCommand(
    guild: Guild,
    message: Message,
    numberOfPlayers: number,
    numberOfGroups: number
  ): Promise<ICommandResult> {
    await this.blobGameService.startNewGame(
      guild,
      numberOfPlayers,
      numberOfGroups
    );

    await message.reply(
      `la partie est démarrée pour ${numberOfPlayers} joueurs répartis sur ${numberOfGroups} groupes !`
    );
    return {
      resultString: `[BlobCommand] Partie démarrée pour ${numberOfPlayers} joueurs répartis sur ${numberOfGroups} groupes`,
    };
  }

  private async handleAdminEndCommand(
    guild: Guild,
    message: Message
  ): Promise<ICommandResult> {
    await this.blobGameService.endGame(guild);
    await message.reply(`partie terminée !`);
    return {
      resultString: `[BlobCommand] Fin de partie}`,
    };
  }

  private async handleAdminStatsCommand(
    guild: Guild,
    message: Message
  ): Promise<ICommandResult> {
    const statsEmbed = this.blobGameService.createGameStatsEmbed(guild);
    if (statsEmbed) {
      await message.channel.send({ embeds: [statsEmbed] });
      return {
        resultString: `[BlobCommand] Statistiques de jeu envoyées`,
      };
    } else {
      await message.reply("pas de statistiques de jeu disponibles.");
      return {
        resultString: `[BlobCommand] Pas de statistiques de jeu disponibles`,
      };
    }
  }

  private async handleAdminTimerCommand(
    guild: Guild,
    message: Message,
    timerAction: string,
    timerActionParams: string[]
  ): Promise<ICommandResult> {
    if (timerAction === "start") {
      if (
        timerActionParams.length > 0 &&
        !isNaN(parseInt(timerActionParams[0], 10))
      ) {
        return await this.handleAdminTimerStartCommand(
          guild,
          message,
          parseInt(timerActionParams[0], 10)
        );
      }
    }
    if (timerAction === "pause") {
      return await this.handleAdminTimerPauseCommand(guild, message);
    }
    if (timerAction === "resume") {
      return await this.handleAdminTimerResumeCommand(guild, message);
    }
    return await this.handleUnknownCommand(message);
  }

  private async handleAdminTimerStartCommand(
    guild: Guild,
    message: Message,
    minutes: number
  ): Promise<ICommandResult> {
    this.blobGameService.startTimer(guild, minutes);
    await message.reply(`minuterie de ${minutes} minutes lancée !`);
    return {
      resultString: `[BlobCommand] Minuterie de ${minutes} minutes lancée`,
    };
  }

  private async handleAdminTimerPauseCommand(
    guild: Guild,
    message: Message
  ): Promise<ICommandResult> {
    this.blobGameService.pauseTimer(guild);
    await message.reply(`la minuterie est arrêtée !`);
    return {
      resultString: `[BlobCommand] Arrêt de la minuterie`,
    };
  }

  private async handleAdminTimerResumeCommand(
    guild: Guild,
    message: Message
  ): Promise<ICommandResult> {
    this.blobGameService.resumeTimer(guild);
    await message.reply(`la minuterie a repris !`);
    return {
      resultString: `[BlobCommand] Reprise de la minuterie`,
    };
  }

  private async handlePlayerCommand(
    guild: Guild,
    message: Message,
    playerAction: string,
    playerActionParams: string[]
  ): Promise<ICommandResult> {
    if (playerAction === "d") {
      if (
        playerActionParams.length > 0 &&
        !isNaN(parseInt(playerActionParams[0], 10))
      ) {
        return await this.handlePlayerDamageCommand(
          guild,
          message,
          parseInt(playerActionParams[0], 10)
        );
      }
    }
    if (playerAction === "i") {
      if (
        playerActionParams.length > 0 &&
        !isNaN(parseInt(playerActionParams[0], 10))
      ) {
        return await this.handlePlayerClueCommand(
          guild,
          message,
          parseInt(playerActionParams[0], 10)
        );
      }
    }
    if (playerAction === "cm") {
      return await this.handlePlayerSpendCounterMeasureCommand(guild, message);
    }
    if (playerAction === "cm+") {
      return await this.handlePlayerGainCounterMeasureCommand(guild, message);
    }
    return await this.handleUnknownCommand(message);
  }

  private async handlePlayerDamageCommand(
    guild: Guild,
    message: Message,
    numberOfDamageDealt: number
  ): Promise<ICommandResult> {
    await this.blobGameService.dealDamageToBlob(
      guild,
      numberOfDamageDealt,
      message.channel as TextChannel
    );
    await message.reply(
      `c'est pris en compte, ${numberOfDamageDealt} infligé(s) !`
    );
    return {
      resultString: `[BlobCommand] ${numberOfDamageDealt} dégât(s) infligé(s)`,
    };
  }

  private async handlePlayerClueCommand(
    guild: Guild,
    message: Message,
    numberOfClues: number
  ): Promise<ICommandResult> {
    await this.blobGameService.placeCluesOnAct1(
      guild,
      numberOfClues,
      message.channel as TextChannel
    );
    await message.reply(
      `c'est pris en compte, ${numberOfClues} indice(s) placés sur l'Acte 1 !`
    );
    return {
      resultString: `[BlobCommand] ${numberOfClues} indice(s) placés`,
    };
  }

  private async handlePlayerSpendCounterMeasureCommand(
    guild: Guild,
    message: Message
  ): Promise<ICommandResult> {
    await this.blobGameService.spendCounterMeasures(
      guild,
      1,
      message.channel as TextChannel
    );
    await message.reply(`c'est pris en compte, 1 contre-mesures dépensée !`);
    return {
      resultString: `[BlobCommand] 1 contre-mesures dépensée`,
    };
  }

  private async handlePlayerGainCounterMeasureCommand(
    guild: Guild,
    message: Message
  ): Promise<ICommandResult> {
    await this.blobGameService.gainCounterMeasures(
      guild,
      1,
      message.channel as TextChannel
    );
    await message.reply(`c'est pris en compte, 1 contre-mesures ajoutée !`);
    return {
      resultString: `[BlobCommand] 1 contre-mesures ajoutée`,
    };
  }

  private async handleUnknownCommand(
    message: Message
  ): Promise<ICommandResult> {
    await message.reply("désolé, je n'ai pas compris.");
    return { resultString: `[BlobCommand] Commande non comprise.` };
  }
}

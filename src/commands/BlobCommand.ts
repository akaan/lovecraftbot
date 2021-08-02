import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { Inject } from "typescript-ioc";
import { MassMultiplayerEventService } from "../services/MassMultiplayerEventService";
import { EnvService } from "../services/EnvService";
import { Guild, Message, TextChannel } from "discord.js";
import { BlobGameService } from "../services/BlobGameService";

export class BlobCommand implements ICommand {
  aliases = ["blob"];
  help = `Commandes pour gérer une partie massivement multijoueurs du **Dévoreur de Toute Chose**.
Les sous-commandes sont décrites ci-dessous. Sans sous-commande précisée, l'état de la partie sera affichée.

    __*Commandes pour les joueurs*__:
    - \`d [nombre de dégâts]\` inflige ce nombre de dégâts au Dévoreur
    - \`i [nombre d'indices]\` place ce nombre d'indices sur l'Acte 1
    - \`cm [nombre de contre-mesures]\` utilise ce nombre de contre-mesures
    - \`cm+ [nombre de contre-mesures]\` ajoute ce nombre de contre-mesures

    __*Commandes pour les organisateurs*__:
    - \`admin start [nombre de joueurs] [nombre de groupes]\` pour démarrer une partie
    - \`admin end\` termine la partie`;

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

          if (adminAction === "end") {
            if (!this.blobGameService.isGameRunning(message.guild))
              return this.noGame(message);
            return this.endGame(message.guild, message);
          }
        }
      }

      if (!this.blobGameService.isGameRunning(message.guild))
        return this.noGame(message);

      // COMMANDES JOUEURS

      if (subCmd === "") {
        return this.gameState(message.guild, message);
      }

      if (
        subCmd === "d" &&
        params.length > 0 &&
        !isNaN(parseInt(params[0], 10))
      ) {
        return this.dealDamage(message.guild, parseInt(params[0], 10), message);
      }

      if (
        subCmd === "i" &&
        params.length > 0 &&
        !isNaN(parseInt(params[0], 10))
      ) {
        return this.placeClues(message.guild, parseInt(params[0], 10), message);
      }

      if (
        subCmd === "cm" &&
        params.length > 0 &&
        !isNaN(parseInt(params[0], 10))
      ) {
        return this.spendCounterMeasure(
          message.guild,
          parseInt(params[0], 10),
          message
        );
      }

      if (
        subCmd === "cm+" &&
        params.length > 0 &&
        !isNaN(parseInt(params[0], 10))
      ) {
        return this.gainCounterMeasure(
          message.guild,
          parseInt(params[0], 10),
          message
        );
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
    const gameState = this.blobGameService.createGameStateEmbed(guild);
    if (gameState) await message.reply(gameState);
    return {
      resultString: `[BlobCommand] Partie démarrée pour ${numberOfPlayers} joueurs répartis sur ${numberOfGroups} groupes`,
    };
  }

  private async noGame(message: Message): Promise<ICommandResult> {
    await message.reply(`pas possible, il n'y a pas de partie en cours.`);
    return {
      resultString: `[BlobCommand] Impossible de traiter la commande, pas de partie en cours`,
    };
  }

  private async endGame(
    guild: Guild,
    message: Message
  ): Promise<ICommandResult> {
    await this.blobGameService.endGame(guild);
    await this.massMultiplayerEventService.cleanGroupChannels(guild);
    await message.reply(`partie terminée !`);
    return {
      resultString: `[BlobCommand] Fin de partie}`,
    };
  }

  private async gameState(
    guild: Guild,
    message: Message
  ): Promise<ICommandResult> {
    const gameState = this.blobGameService.createGameStateEmbed(guild);
    if (gameState) {
      await message.reply(gameState);
      return {
        resultString: `[BlobCommand] Etat de la partie envoyée`,
      };
    }
    return {
      resultString: `[BlobCommand] Problème à l'envoi de l'état de la partie : pas de partie`,
    };
  }

  private async dealDamage(
    guild: Guild,
    numberOfDamageDealt: number,
    message: Message
  ): Promise<ICommandResult> {
    try {
      await this.blobGameService.dealDamageToBlob(
        guild,
        numberOfDamageDealt,
        message.channel.id
      );

      if (this.blobGameService.getBlobRemainingHealth(guild) === 0) {
        await message.reply(
          `vous portez le coup fatal avec ${numberOfDamageDealt} infligé(s) ! Bravo !`
        );
        await this.massMultiplayerEventService.broadcastMessage(
          guild,
          `${
            (message.channel as TextChannel).name
          } a porté le coup fatal en infligeant ${numberOfDamageDealt} dégât(s) au Dévoreur !`,
          [message.channel.id]
        );
      } else {
        await message.reply(
          `c'est pris en compte, ${numberOfDamageDealt} infligé(s) !`
        );
        await this.massMultiplayerEventService.broadcastMessage(
          guild,
          `${
            (message.channel as TextChannel).name
          } a infligé ${numberOfDamageDealt} dégât(s) au Dévoreur !`,
          [message.channel.id]
        );
      }
      return {
        resultString: `[BlobCommand] ${numberOfDamageDealt} dégât(s) infligé(s)`,
      };
    } catch (err) {
      await message.reply(`impossible: ${(err as Error).message}`);
      return {
        resultString: `[BlobCommand] Impossible d'infliger des dégâts : ${
          (err as Error).message
        }`,
      };
    }
  }

  private async placeClues(
    guild: Guild,
    numberOfClues: number,
    message: Message
  ): Promise<ICommandResult> {
    try {
      await this.blobGameService.placeCluesOnAct1(
        guild,
        numberOfClues,
        message.channel.id
      );
      await message.reply(
        `c'est pris en compte, ${numberOfClues} indice(s) placés sur l'Acte 1 !`
      );
      await this.massMultiplayerEventService.broadcastMessage(
        guild,
        `${
          (message.channel as TextChannel).name
        } a placé ${numberOfClues} indice(s) sur l'Acte 1 !`,
        [message.channel.id]
      );
      return {
        resultString: `[BlobCommand] ${numberOfClues} indice(s) placés`,
      };
    } catch (err) {
      await message.reply(`impossible: ${(err as Error).message}`);
      return {
        resultString: `[BlobCommand] Impossible de placer des indices : ${
          (err as Error).message
        }`,
      };
    }
  }

  private async spendCounterMeasure(
    guild: Guild,
    numberOfCounterMeasures: number,
    message: Message
  ): Promise<ICommandResult> {
    try {
      await this.blobGameService.spendCounterMeasures(
        guild,
        numberOfCounterMeasures,
        message.channel.id
      );
      await message.reply(
        `c'est pris en compte, ${numberOfCounterMeasures} contre-mesures dépensée(s) !`
      );
      await this.massMultiplayerEventService.broadcastMessage(
        guild,
        `${
          (message.channel as TextChannel).name
        } a dépensé ${numberOfCounterMeasures} contre-mesures(s) !`,
        [message.channel.id]
      );
      return {
        resultString: `[BlobCommand] ${numberOfCounterMeasures} contre-mesures dépensée(s)`,
      };
    } catch (err) {
      await message.reply(`impossible: ${(err as Error).message}`);
      return {
        resultString: `[BlobCommand] Impossible de dépenser des contre-mesures : ${
          (err as Error).message
        }`,
      };
    }
  }

  private async gainCounterMeasure(
    guild: Guild,
    numberOfCounterMeasures: number,
    message: Message
  ): Promise<ICommandResult> {
    try {
      await this.blobGameService.gainCounterMeasures(
        guild,
        numberOfCounterMeasures,
        message.channel.id
      );
      await message.reply(
        `c'est pris en compte, ${numberOfCounterMeasures} contre-mesures ajoutée(s) !`
      );
      await this.massMultiplayerEventService.broadcastMessage(
        guild,
        `${
          (message.channel as TextChannel).name
        } a ajouté ${numberOfCounterMeasures} contre-mesures(s) !`,
        [message.channel.id]
      );
      return {
        resultString: `[BlobCommand] ${numberOfCounterMeasures} contre-mesures ajoutée(s)`,
      };
    } catch (err) {
      await message.reply(`impossible: ${(err as Error).message}`);
      return {
        resultString: `[BlobCommand] Impossible d'ajouter des contre-mesures : ${
          (err as Error).message
        }`,
      };
    }
  }
}

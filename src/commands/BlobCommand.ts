import { ICommand, ICommandArgs, ICommandResult } from "../interfaces";
import { Inject } from "typescript-ioc";
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
    - \`story\` obtenir l'histoire retenue pour cette partie

    __*Commandes pour les organisateurs*__:
    - \`admin start [nombre de joueurs] [nombre de groupes]\` pour démarrer une partie
    - \`admin stats\` affiche les statistiques
    - \`admin end\` termine la partie
    - \`admin timer init [minutes]\` démarre une minuterie du nombre de minutes indiquées
    - \`admin timer pause\` met en pause la minuterie
    - \`admin timer resume\` reprend la mintuerie`;

  @Inject private blobGameService!: BlobGameService;

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

    if (!this.blobGameService.ready()) {
      await message.reply("désolé mais j'ai un problème de configuration.");
      return {
        resultString: `[BlobCommand] Impossible de traiter la commande en l'absence de configuration.`,
      };
    }

    const [subCmd, ...params] = args.split(" ");

    if (this.blobGameService.isEventChannel(message.channel)) {
      // COMMANDES ADMIN
      if (subCmd === "admin") {
        if (this.blobGameService.isAdminChannel(message.channel)) {
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
                parseInt(numberOfPlayers, 10),
                parseInt(numberOfGroups, 10),
                message
              );
            }
          }

          if (!this.blobGameService.isGameRunning(message.guild))
            return this.noGame(message);

          if (adminAction === "stats") {
            const statsEmbed = this.blobGameService.createGameStatsEmbed(
              message.guild
            );
            if (statsEmbed) {
              await message.reply(statsEmbed);
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

          if (adminAction === "end") {
            return this.endGame(message.guild, message);
          }

          if (adminAction === "timer") {
            const [timerAction, ...timerActionParams] = adminActionParams;
            if (timerAction === "start") {
              if (
                timerActionParams.length > 0 &&
                !isNaN(parseInt(timerActionParams[0], 10))
              ) {
                const minutes = parseInt(timerActionParams[0], 10);
                this.blobGameService.startTimer(message.guild, minutes);
                await message.reply(`minuterie de ${minutes} minutes lancée !`);
                return {
                  resultString: `[BlobCommand] Minuterie de ${minutes} minutes lancée`,
                };
              }
            }
            if (timerAction === "pause") {
              this.blobGameService.pauseTimer(message.guild);
              await message.reply(`la minuterie est arrêtée !`);
              return {
                resultString: `[BlobCommand] Arrêt de la minuterie`,
              };
            }
            if (timerAction === "resume") {
              this.blobGameService.resumeTimer(message.guild);
              await message.reply(`la minuterie a repris !`);
              return {
                resultString: `[BlobCommand] Reprise de la minuterie`,
              };
            }
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

      if (subCmd === "story") {
        const story = this.blobGameService.getStory(message.guild);
        if (story) {
          await message.reply(`l'histoire retenue est : ${story}`);
          return {
            resultString: `[BlobCommand] Histoire envoyée`,
          };
        } else {
          await message.reply(`hmmm, il est peut-être trop tôt pour ça.`);
          return {
            resultString: `[BlobCommand] Pas d'histoire disponible`,
          };
        }
      }
    }

    await message.reply("désolé, je n'ai pas compris.");
    return { resultString: `[BlobCommand] Commande "${args}" non comprise.` };
  }

  private async startGame(
    guild: Guild,
    numberOfPlayers: number,
    numberOfGroups: number,
    message: Message
  ): Promise<ICommandResult> {
    try {
      await this.blobGameService.startNewGame(
        guild,
        numberOfPlayers,
        numberOfGroups
      );

      await message.reply(
        `la partie est démarrée pour ${numberOfPlayers} joueurs répartis sur ${numberOfGroups} groupes !`
      );
      const gameState = this.blobGameService.createGameStateEmbed(guild);
      if (gameState) await message.reply(gameState);
      return {
        resultString: `[BlobCommand] Partie démarrée pour ${numberOfPlayers} joueurs répartis sur ${numberOfGroups} groupes`,
      };
    } catch (err) {
      await message.reply(`j'ai eu un problème : ${(err as Error).message}.`);
      return {
        resultString: `[BlobCommand] Impossible de démarrer la partie : ${
          (err as Error).message
        }`,
      };
    }
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
        message.channel as TextChannel
      );
      await message.reply(
        `c'est pris en compte, ${numberOfDamageDealt} infligé(s) !`
      );
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
        message.channel as TextChannel
      );
      await message.reply(
        `c'est pris en compte, ${numberOfClues} indice(s) placés sur l'Acte 1 !`
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
        message.channel as TextChannel
      );
      await message.reply(
        `c'est pris en compte, ${numberOfCounterMeasures} contre-mesures dépensée(s) !`
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
        message.channel as TextChannel
      );
      await message.reply(
        `c'est pris en compte, ${numberOfCounterMeasures} contre-mesures ajoutée(s) !`
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

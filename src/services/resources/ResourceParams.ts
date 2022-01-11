import { Client } from "discord.js";

import { LoggerService } from "../LoggerService";
import { ResourcesService } from "../ResourcesService";

/**
 * Les paramètres nécessaires au fonctionnement d'un ressource de serveur.
 */
export interface ResourceParams {
  /** Le nom du fichier pour la sauvegarde */
  filename: string;

  /** Le client Discord permettant d'accéder aux serveurs */
  client: Client;

  /** Le logger */
  logger: LoggerService;

  /** L'étiquette pour les logs */
  logLabel: string;

  /** Le service de gestion des ressources */
  resourcesService: ResourcesService;

  /** Exécuté après chargement des données */
  onLoaded?: () => void;
}

import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

@Singleton
@OnlyInstantiableByContainer
/**
 * Service permettant au bot d'accéder à des variables d'environnement.
 */
export class EnvService extends BaseService {
  /**
   * Le jeton de connexion à Discord.
   */
  public get discordToken(): string | undefined {
    return process.env.DISCORD_TOKEN;
  }

  /**
   * Mode d'exécution du bot : développement ou production
   */
  public get mode(): "development" | "production" {
    if (process.env.MODE == "development") {
      return "development";
    }
    return "production";
  }

  /**
   * Le préfixe pour le lancement des commandes classiques.
   */
  public get commandPrefix(): string {
    return process.env.COMMAND_PREFIX || "!";
  }

  /**
   * Indique s'il faut ignorer le positionnement d'un message de présence
   * du bot.
   */
  public get ignorePresence(): boolean {
    return !!process.env.IGNORE_PRESENCE;
  }

  /**
   * Nom de la catégorie de canaux où sont gérés les événements multijoueurs
   */
  public get massMultiplayerEventCategoryName(): string | undefined {
    return process.env.MASS_MULTIPLAYER_EVENT_CATEGORY;
  }

  /** Nom du canal réservé aux organisateurs d'un événement multijoueurs */
  public get massMultiplayerEventAdminChannelName(): string | undefined {
    return process.env.MASS_MULTIPLAYER_EVENT_ADMIN_CHANNEL;
  }

  /** Nom du rôle ayant accès aux commandes d'administration du bot */
  public get botAdminRoleName(): string | undefined {
    return process.env.BOT_ADMIN_ROLE;
  }
}

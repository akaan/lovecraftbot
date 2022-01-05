import { OnlyInstantiableByContainer, Singleton } from "typescript-ioc";

import { BaseService } from "../base/BaseService";

/**
 * Une entrée dans l'aide des commandes classiques.
 */
interface HelpText {
  /** Le nom de la commande classique */
  command: string;

  /** Les alias permettant d'appeler cette commande */
  aliases: string[];

  /** Le texte d'aide de la commande */
  help: string;

  /** Indique si la commande est une commande réservée aux administrateurs */
  admin: boolean;
}

@Singleton
@OnlyInstantiableByContainer
/**
 * Service permettant de collecter et de restituer les aides
 * des commandes classiques.
 */
export class HelpService extends BaseService {
  /** L'ensemble des entrées d'aide pour les commandes classiques */
  private helpTexts: HelpText[] = [];

  /**
   * Récupère l'ensemble des aides des commandes classiques.
   *
   * @returns Une liste d'entrées d'aide
   */
  public get allHelp(): HelpText[] {
    return this.helpTexts;
  }

  /**
   * Ajoute une entrée à l'ensemble des aides déjà collectées.
   *
   * @param help L'entrée d'aide à ajouter
   */
  public addHelp(help: HelpText): void {
    this.helpTexts.push(help);
  }
}

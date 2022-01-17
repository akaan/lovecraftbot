/**
 * Représentation de l'état d'une partie du scénario Le Dévoreur de Toute Chose
 */
export class BlobGame {
  /** Points de santé de départ par investigateur */
  private static PER_INVESTIGATOR_TOTAL_HEALTH = 15;

  /** Nombre d'indices de départ sur l'acte 1 par investigateur */
  private static PER_INVESTIGATOR_ACT1_CLUE_THRESHOLD = 2;

  /** Les histoires possibles à l'issue de l'acte 1 */
  public static POSSIBLE_STORIES = [
    "Secourir la Chimiste",
    "Récupérer le Fragment",
    "Repousser les Mi-Go",
    "Désarmorcer les Explosifs",
  ];

  /** Identifiant de la partie */
  private id: number;

  /** Date de création de la partie */
  private dateCreated: Date;

  /** Date de fin de la partie */
  private dateEnded?: Date;

  /** Nombre de joueurs dans la partie */
  private numberOfPlayers: number;

  /** Nombre de dégâts infligés au Dévoreur */
  private numberOfDamageDealtToBlob: number;

  /** Nombre d'indices sur l'acte 1 */
  private numberOfCluesOnAct1: number;

  /** Nombre de contre-mesures détenues */
  private numberOfCounterMeasures: number;

  /** Histoire */
  private story?: string;

  constructor(id: number, dateCreated: Date, numberOfPlayers: number) {
    this.id = id;
    this.dateCreated = dateCreated;
    this.numberOfPlayers = numberOfPlayers;

    this.numberOfDamageDealtToBlob = 0;
    this.numberOfCluesOnAct1 = 0;
    this.numberOfCounterMeasures = 0;
  }

  /**
   * Renvoie l'identifiant de la partie.
   *
   * @returns L'identifiant de la partie
   */
  public getId(): number {
    return this.id;
  }

  /**
   * Renvoie la date de création de la partie.
   *
   * @returns La date de création de la partie
   */
  public getDateCreated(): Date {
    return this.dateCreated;
  }

  /**
   * Renvoie le nombre de joueurs dans la partie.
   *
   * @returns Le nombre de joueurs dans la partie
   */
  public getNumberOfPlayers(): number {
    return this.numberOfPlayers;
  }

  /**
   * Renvoie le total de santé de départ du Dévoreur.
   *
   * @returns Le total de santé de départ du Dévoreur
   */
  public getBlobTotalHealth(): number {
    return this.numberOfPlayers * BlobGame.PER_INVESTIGATOR_TOTAL_HEALTH;
  }

  /**
   * Renvoie le nombre de dégâts infligés au Dévoreur.
   *
   * @returns Le nombre de dégâts infligés au Dévoreur
   */
  public getNumberOfDamageDealtToBlob(): number {
    return this.numberOfDamageDealtToBlob;
  }

  /**
   * Renvoie le nombre de points de santé restants au Dévoreur.
   *
   * @returns Le nombre de point de santé restants au Dévoreur
   */
  public getBlobRemainingHealth(): number {
    return this.getBlobTotalHealth() - this.numberOfDamageDealtToBlob;
  }

  /**
   * Inflige le nombre de points de dégât indiqués au Dévoreur.
   *
   * @param amount Le nombre de dégâts à infliger
   * @returns La partie
   */
  public dealDamageToBlob(amount: number): this {
    this.numberOfDamageDealtToBlob = Math.min(
      this.getBlobTotalHealth(),
      this.numberOfDamageDealtToBlob + amount
    );
    return this;
  }

  /**
   * Corrige le nombre de points de dégâts infligés au Dévoreur.
   *
   * @param numberOfDamage Le nombre de points de dégât
   * @returns La partie
   */
  public setNumberOfDamageDealtToBlob(numberOfDamage: number): this {
    this.numberOfDamageDealtToBlob = Math.min(
      this.getBlobTotalHealth(),
      numberOfDamage
    );
    return this;
  }

  /**
   * Renvoie le seuil d'indices de l'acte 1.
   *
   * @returns Le seuil d'indices de l'acte 1
   */
  public getAct1ClueThreshold(): number {
    return this.numberOfPlayers * BlobGame.PER_INVESTIGATOR_ACT1_CLUE_THRESHOLD;
  }

  /**
   * Renvoie le nombre d'indices sur l'acte 1.
   *
   * @returns Le nombre d'indices sur l'acte 1
   */
  public getNumberOfCluesOnAct1(): number {
    return this.numberOfCluesOnAct1;
  }

  /**
   * Dépose le nombre d'indices indiqués sur l'acte 1.
   *
   * @param numberOfClues Le nombre d'indices à déposer
   * @returns La partie
   */
  public placeCluesOnAct1(numberOfClues: number): this {
    this.numberOfCluesOnAct1 = Math.min(
      this.getAct1ClueThreshold(),
      this.numberOfCluesOnAct1 + numberOfClues
    );
    return this;
  }

  /**
   * Corrige le nombre d'indices sur l'acte 1.
   *
   * @param numberOfClues Le nombre d'indices
   * @returns La partie
   */
  public setCluesOnAct1(numberOfClues: number): this {
    this.numberOfCluesOnAct1 = Math.min(
      this.getAct1ClueThreshold(),
      numberOfClues
    );
    return this;
  }

  /**
   * Renvoie le nombre de contre-mesures des investigateurs.
   *
   * @returns Le nombre de contre-mesures
   */
  public getNumberOfCounterMeasures(): number {
    return this.numberOfCounterMeasures;
  }

  /**
   * Initie le nombre de contre-mesures disponible au début de la partie en
   * fonction du nombre de joueurs.
   *
   * @returns La partie
   */
  public initNumberOfCounterMeasure(): this {
    this.numberOfCounterMeasures = Math.ceil(this.numberOfPlayers / 2);
    return this;
  }

  /**
   * Permet d'indiquer que des contre-mesures ont été acquises.
   *
   * @param numberOfCounterMeasures Le nombre de contre-mesures gagnées
   * @returns La partie
   */
  public gainCounterMeasures(numberOfCounterMeasures: number): this {
    this.numberOfCounterMeasures += numberOfCounterMeasures;
    return this;
  }

  /**
   * Permet de dépenser des contre-mesures.
   *
   * @param numberOfCounterMeasures Le nombre de contre-mesures dépensées
   * @returns La partie
   */
  public spendCounterMeasures(numberOfCounterMeasures: number): this {
    if (numberOfCounterMeasures > this.numberOfCounterMeasures) {
      throw new Error(
        "Impossible, pas suffisamment de contre-mesures disponibles"
      );
    }
    this.numberOfCounterMeasures -= numberOfCounterMeasures;
    return this;
  }

  /**
   * Corrige le nombre de contre-mesures.
   *
   * @param numberOfCounterMeasures Le nombre de contre-mesures
   * @returns La partie
   */
  public setNumberOfCounterMeasures(numberOfCounterMeasures: number): this {
    this.numberOfCounterMeasures = numberOfCounterMeasures;
    return this;
  }

  /**
   * Renvoie l'histoire sélectionnée après l'acte 1 (si l'ate 1 a été passé).
   *
   * @returns L'histoire
   */
  public getStory(): string | undefined {
    return this.story;
  }

  /**
   * Précise l'histoire qui a été sélectionnée à l'issue de l'acte 1.
   *
   * @param story L'histoire sélectionné
   * @returns La partie
   */
  public chooseStory(story: string): this {
    if (!BlobGame.POSSIBLE_STORIES.includes(story)) {
      throw new Error(`"${story}" n'est pas une valeur possible de story.`);
    }
    this.story = story;
    return this;
  }

  /**
   * Renvoie la date de fin de la partie (si elle est finie).
   *
   * @returns La date de fin de la partie
   */
  public getDateEnded(): Date | undefined {
    return this.dateEnded;
  }

  /**
   * Met fin à la partie avec la date indiquée.
   *
   * @param dateEnded Date de fin
   * @returns La partie
   */
  public endGame(dateEnded: Date): this {
    this.dateEnded = dateEnded;
    return this;
  }
}

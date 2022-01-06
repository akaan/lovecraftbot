/**
 * Récupère le nom du constrcuteur d'une instance d'objet donné. Cette
 * fonction gère le cas d'un object instancié par le conteneur IOC.
 *
 * @param instance L'instance dont on veut le nom du constructeur
 * @returns Le nom du constructeur de l'instance
 */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
export function nameOfConstructor(instance: any): string {
  if (instance.constructor.name === "ioc_wrapper") {
    return instance.constructor["__parent"].name as string;
  }
  return instance.constructor.name as string;
}

/**
 * Les fonctions à exécuter selon le nombre d'éléments dans un tableau
 *
 * @template E Le type des éléments du tableau
 * @template R Le type du retour des fonctions
 */
interface CaseOfLengthPatterns<E, R> {
  /**
   * Fonction à exécuter si le tableau ne contient qu'un élément.
   *
   * @param elem L'unique élément du tableau
   */
  ifOne: (elem: E) => R;

  /**
   * Fonction à exécuter si le tableau contient plusieurs éléments.
   *
   * @param elems Les élements du tableau
   */
  ifMany: (elems: E[]) => R;

  /**
   * Fonction à exécuter si le tableau est vide.
   */
  ifEmpty: () => R;
}

/**
 * Vérifie le nombre d'éléments dans le tableau fourni et exécute la fonction
 * correspondante.
 *
 * @template E Le type des éléments du tableau
 * @template R Le type du retour de la fonction
 * @param elems Le tableau d'éléments à analyser
 * @param patterns Les différentes fonctions à exécuter selon le nombre
 *                 d'éléments dans le tableau
 * @returns Le retour de la fonction qui aura été lancée
 */
export function caseOfLength<E, R>(
  elems: E[],
  patterns: CaseOfLengthPatterns<E, R>
): R {
  if (elems.length > 0) {
    if (elems.length === 1) {
      return patterns.ifOne(elems[0]);
    } else {
      return patterns.ifMany(elems);
    }
  } else {
    return patterns.ifEmpty();
  }
}

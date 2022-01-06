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

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
export function nameOfConstructor(instance: any): string {
  if (instance.constructor.name === "ioc_wrapper") {
    return instance.constructor["__parent"].name as string;
  }
  return instance.constructor.name as string;
}

import { snakeCase } from "./snake-case.function";

export function kebabCase(string: string) {
  return snakeCase(string).replace(/_/g, '-');
}

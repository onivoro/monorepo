import { TNameable } from "../types/nameable.type";
import { getUserFullName } from "./get-user-full-name.function";

export function sortByFullName<TEntity extends TNameable>(a: TEntity, b: TEntity) {
    return getUserFullName(a).localeCompare(getUserFullName(b)) || 0;
}
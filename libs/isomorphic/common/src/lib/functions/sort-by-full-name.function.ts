import { TNameable, getUserFullName } from "@onivoro/isomorphic/common";

export function sortByFullName<TEntity extends TNameable>(a: TEntity, b: TEntity) {
    return getUserFullName(a).localeCompare(getUserFullName(b)) || 0;
}
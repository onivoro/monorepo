import { TCreateable } from "../types/createable.type";

export function sortByCreatedAt<TEntity extends TCreateable>(a: TEntity, b: TEntity) {
    const isLessThan = a.createdAt < b.createdAt;

    return isLessThan ? -1 : 1;
}
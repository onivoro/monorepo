import { Between, FindOperator, LessThanOrEqual, MoreThanOrEqual } from "typeorm";

export function generateDateQuery(
    minDueDate: string,
    maxDueDate: string
): FindOperator<Date> {
    if (minDueDate && maxDueDate) {
        return Between(minDueDate as any, maxDueDate as any);
    }

    if (maxDueDate) {
        return LessThanOrEqual(new Date(maxDueDate));
    }

    if (minDueDate) {
        return MoreThanOrEqual(new Date(minDueDate));
    }

    return undefined as any;
}
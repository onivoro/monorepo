import { TNameable } from "../types/nameable.type";

export function getUserFullName(user: TNameable | undefined): string {
    return `${user?.firstName} ${user?.lastName}`;
}
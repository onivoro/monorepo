import { subtractOffset } from "./subtract-offset.function";

export function toCalendarDate(input: string | Date | undefined | null): string | undefined {
    const parsed = subtractOffset(input);

    if (!parsed) {
        return;
    }

    return parsed?.toISOString().split('T')[0];
}

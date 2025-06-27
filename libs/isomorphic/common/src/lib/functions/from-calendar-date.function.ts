import { addOffset } from "./add-offset.function";

export function fromCalendarDate(input: string | Date | undefined | null): Date | null {
    return addOffset(input) || null;
}

import { MILLIS_PER_MINUTE } from '../constants/millis-per-minute.constant';
import { tryParseDate } from './try-parse-date.function';

export function addOffset(input: string | Date | undefined | null): Date | undefined {
    const parsed = tryParseDate(input);

    if(!parsed) {
        return;
    }

    const offset = (parsed).getTimezoneOffset();

    return new Date(parsed.valueOf() + offset * MILLIS_PER_MINUTE);
}

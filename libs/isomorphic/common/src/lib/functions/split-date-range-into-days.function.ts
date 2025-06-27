import { MILLIS_PER_DAY } from "@onivoro/isomorphic/common";

const iso8601Regex = /\d{4}-\d{2}-\d{2}/;

export function splitDateRangeIntoDays(_: { from: string, to: string }): string[] {
    const { from = '', to = '' } = _;
    const days: Date[] = [];

    if (!from || !to || !iso8601Regex.test(from) || !iso8601Regex.test(to)) {
        return days as any[];
    }

    const _from = new Date(from);
    const _to = new Date(to);

    let current = _from;

    while (current < _to) {
        days.push(current);
        current = new Date(+current + MILLIS_PER_DAY);
    }

    days.push(_to);

    return days.map(day => day.toISOString().split('T')[0]);
}
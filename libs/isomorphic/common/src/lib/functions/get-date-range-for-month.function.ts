import { MILLIS_PER_DAY } from "../constants/millis-per-day.constant";

export function getDateRangeForMonth(year: number, month: number) {
    const startDate = new Date(+Date.UTC(year, month + -1, 0) + MILLIS_PER_DAY);
    const endDate = new Date(+Date.UTC(year, month + 0, 0) + MILLIS_PER_DAY);

    return { startDate, endDate };
}
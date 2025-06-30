import { MILLIS_PER_DAY } from "../constants/millis-per-day.constant";

export function getDateLastMonth() {
    const days = new Date().getUTCDate() + 1;
    return new Date(Date.now() - (MILLIS_PER_DAY * days));
}
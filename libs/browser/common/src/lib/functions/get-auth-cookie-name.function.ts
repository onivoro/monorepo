
const allPeriods = /\./g;
const allColons = /\:/g;
const _ = '_';

export function getAuthCookieName() {
    return location.host.replace(allPeriods, _).replace(allColons, _);
}
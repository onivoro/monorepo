import { decimalRegex } from "../constants/regexes.constant";

export function removeAlphaChars(input?: string | number) {
    if (!input) {
        return;
    }

    return input.toString().match(decimalRegex)?.join?.('');
}
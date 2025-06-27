import { IFieldOption } from "../types/field-option.interface";
import { formatRegexes } from "./format-regexes.constant";

const pwSpecial = formatRegexes.passwordSpecial.toString();
const pwSpecialChars = pwSpecial
    .split('|')
    .map((char) => char.replace('\\', '').replace('/', ''))
    .join(' ');


export function getErrorMessage(
    error?: { type?: string },
    validators?: IFieldOption['validators']
) {
    const type = error?.type;

    if (!type) {
        return '';
    }

    if (type === 'required') {
        return 'Required';
    }

    if (type === 'minLength') {
        return `Must be at least ${validators?.minLength} characters`
    }

    if (type === 'maxLength') {
        return `Must be less than ${validators?.maxLength} characters`
    }

    if (type === 'max') {
        return `Cannot be more than ${validators?.max}`;
    }

    if (type === 'min') {
        return `Must be at least ${validators?.min}`;
    }

    if (type === 'pattern') {
        let msg: string;

        const pattern = (validators?.pattern || '').toString();

        switch (pattern) {
            case formatRegexes.firstSpaceLast.toString():
                msg = `Format must be "Firstname Lastname" with exactly one space (ex: Bob O'Brien)`;
                break;
            case formatRegexes.dashesLettersNumbers.toString():
                msg = 'Can only contain dashes, letters, and numbers';
                break;
            case formatRegexes.dashesLettersNumbersSpaces.toString():
                msg = 'Can only contain dashes, letters, numbers, and spaces';
                break;
            case formatRegexes.url.toString():
                msg = 'Must be a valid url with https:// or http://';
                break;
            case formatRegexes.protocol.toString():
                msg = 'Must begin with http:// or https://';
                break;
            case formatRegexes.code.toString():
                msg = '6 digit numeric code';
                break;
            case formatRegexes.phone.toString():
                msg = 'Must match the format ###-###-####';
                break;
            case formatRegexes.ssn.toString():
                msg = 'Must match the format ###-##-####';
                break;
            case formatRegexes.phonePlusOne.toString():
                msg = 'Must match the format +1##########';
                break;
            case formatRegexes.zip.toString():
                msg = 'Must match the format #####';
                break;
            case formatRegexes.email.toString():
                msg = 'Must be a valid email address';
                break;
            case formatRegexes.numeric.toString():
                msg = 'Must contain numbers only';
                break;
            case formatRegexes.passwordNumber.toString():
                msg = 'Must contain a number';
                break;
            case formatRegexes.passwordUpper.toString():
                msg = 'Must contain an uppercase character';
                break;
            case formatRegexes.passwordLower.toString():
                msg = 'Must contain a lowercase character';
                break;
            case formatRegexes.stateShort.toString():
                msg = 'Must be two uppercase letters';
                break;
            case formatRegexes.ein.toString():
                msg = 'Must match the format ##-#######';
                break;
            case formatRegexes.duns.toString():
                msg = 'Must match the format #########';
                break;
            case formatRegexes.lastFourSocial.toString():
                msg = 'Must match the format ####';
                break;
            case formatRegexes.emailDomain.toString():
                msg = 'Must be a valid email domain (excluding "@")';
                break;
            case pwSpecial:
                msg = `Must contain one of: ${pwSpecialChars}`;
                break;
            default:
                msg = 'Invalid format';
                break;
        }

        return msg;
    }

    return 'Invalid';
};

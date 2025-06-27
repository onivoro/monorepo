import { IFieldOption } from "../types/field-option.interface"
import { formatRegexes } from "./format-regexes.constant";

const required = true;

export const fields = {
    firstName: {
        label: 'First Name',
        type: 'text',
        validators: { required, minLength: 1 }
    } as IFieldOption,
    name: {
        label: 'Name',
        type: 'text',
        validators: { required, minLength: 1 }
    } as IFieldOption,
    lastFourSocial: {
        label: 'Last Four of Social Security',
        type: 'text',
        validators: { pattern: formatRegexes.lastFourSocial }
    } as IFieldOption,
    emailDomain: {
        label: 'Email Domain',
        type: 'text',
        validators: { pattern: formatRegexes.emailDomain }
    } as IFieldOption,
    duns: {
        label: 'DUNS',
        type: 'text',
        validators: { required, pattern: formatRegexes.duns }
    } as IFieldOption,
    hidden: {
        label: '',
        type: 'hidden',
    } as IFieldOption,
    ein: {
        label: 'EIN',
        type: 'text',
        validators: { required, pattern: formatRegexes.ein }
    } as IFieldOption,
    externalId: {
        label: 'External ID',
        type: 'text',
    } as IFieldOption,
    lastName: {
        label: 'Last Name',
        type: 'text',
        validators: { required, minLength: 1 }
    } as IFieldOption,
    phone: {
        label: 'Phone Number',
        type: 'text',
        validators: { required, pattern: formatRegexes.phone },
    } as IFieldOption,
    email: {
        label: 'Email',
        type: 'text',
        validators: { pattern: formatRegexes.email },
    } as IFieldOption,
    address1: {
        label: 'Address Line 1',
        type: 'text',
        validators: { required },
    } as IFieldOption,
    address2: {
        label: 'Address Line 2',
        type: 'text',
    } as IFieldOption,
    city: {
        label: 'City',
        type: 'text',
        validators: { required },
    } as IFieldOption,
    state: {
        label: 'State',
        type: 'text',
        validators: { required, pattern: formatRegexes.stateShort },
    } as IFieldOption,
    zip: {
        label: 'Zip',
        type: 'text',
        validators: { required, pattern: formatRegexes.zip },
    } as IFieldOption,
    eligible: {
        label: 'Eligible',
        type: 'checkbox',
    } as IFieldOption,
    roleId: {
        label: 'Role',
        type: 'select',
        validators: { required: true },
        options: [{ display: 'No options added', value: '' }]
    } as IFieldOption,
    companyStatusId: {
        label: 'Status',
        type: 'select',
        validators: { required: true },
        options: [{ display: 'No options added', value: '' }]
    } as IFieldOption,
    password: {
        label: 'Password',
        type: 'password',
        validators: { required: true },
    } as IFieldOption,
    renewalDate: {
        label: 'Renewal Date',
        type: 'date',
        validators: { required: true },
    } as IFieldOption,
    dateOfBirth: {
        label: 'Date of Birth',
        type: 'date',
        validators: { required: true },
    } as IFieldOption,
};
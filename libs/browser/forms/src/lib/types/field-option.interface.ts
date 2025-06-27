import { ILookup } from "@onivoro/isomorphic/common";

export interface IFieldOption {
  label?: string,
  placeholder?: string,
  options?: ILookup<string, string>[] | ((formValue: any) => ILookup<string, string>[]),
  type: 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'password' | 'hidden' | 'color' | 'display',
  disabled?: boolean,
  toFormValue?: (externalInput: any) => any,
  fromFormValue?: (formValue: any) => any,
  validators?: {
    min?: number,
    minLength?: number,
    max?: number,
    maxLength?: number,
    pattern?: RegExp,
    required?: boolean,
  },
  className?: string,
  multiple?: boolean;
}

import { TKeysOf } from "@onivoro/isomorphic/common";
import { IFieldOption } from "./field-option.interface";

export type TFormFields<TFormData> = TKeysOf<TFormData, IFieldOption>;
import { FieldValues, UseFormReturn } from "react-hook-form";

export type TOnSubmit<TFormData> = (value: TFormData, form?: UseFormReturn<FieldValues>) => any;
import { TOnSubmit } from "./on-submit.type";

export type TFormConsumerProps<TFormData, TFormSchema = any> = { heading?: string, onSubmit: TOnSubmit<TFormData>, value?: TFormData, schema?: TFormSchema };
import { FormState, UseFormReturn } from "react-hook-form";

type TFormFieldName<TFormData> = keyof TFormData;
type TArbitraryRendererWithValue<TFormData> = (value: TFormData, formState: FormState<any>, form: UseFormReturn) => any;
type TArbitraryRendererWithoutValue = () => any;
type TArbitraryRenderer<TFormData> = TArbitraryRendererWithValue<TFormData> | TArbitraryRendererWithoutValue;
export type TFormLayout<TFormData> = Array<Array<TArbitraryRenderer<TFormData> | TFormFieldName<TFormData>>>;
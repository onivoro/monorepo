import { FC } from "react";
import { useFormContext } from "react-hook-form";
import { Label } from "./Label";
import { TFormControlProps } from "../types/form-control-props.type";

export type TSelectProps = TFormControlProps;

export const Select: FC<TSelectProps> = ({ name, config, className }) => {
    const { register } = useFormContext();

    return <div className='relative'>
        <Label controlId={name} label={config.label}></Label>
        <select id={name} disabled={config.disabled} className={`grow w-full focus:outline-none text-sm py-5 px-4 border border-solid border-light-gray ${config.disabled ? 'cursor-not-allowed' : 'cursor-default'} ${className || ''}`} {...register(name, { ...config.validators })}>
            {(typeof config.options === 'function' ? config.options({}) : config.options || []).map((option, optionIndex) => <option value={option.value} key={`${name}-${optionIndex}`}>{option.display}</option>)}
        </select>
    </div>
};
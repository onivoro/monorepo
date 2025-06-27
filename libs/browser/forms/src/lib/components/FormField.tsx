import { FC } from "react";
import { useFormContext } from "react-hook-form";
import { Label } from "./Label";
import { TFormControlProps } from "../types/form-control-props.type";
import { getErrorMessage } from "../constants/error-messages.constant";

export type TFormFieldProps = TFormControlProps;

export const FormField: FC<TFormFieldProps> = ({ name, config, className }) => {
    const { register, formState } = useFormContext();
    return <div className='flex-1' key={name as string}>
        {(() => {
            const id = `${name}-${Date.now()}`;
            switch (config.type) {
                case 'select':
                    return <div className='relative'>
                        <Label controlId={id} label={config.label}></Label>
                        <select id={id} disabled={config.disabled} className={`grow w-full focus:outline-none text-sm py-5 px-4 border border-solid border-light-gray ${config.disabled ? 'cursor-not-allowed' : 'cursor-default'} ${className || ''}`} {...register(name, { ...config.validators })}>
                            {((typeof config.options === 'function' ? config.options({}) : config.options) || []).map((option, optionIndex) => <option value={option.value} key={`${name}-${optionIndex}`}>{option.display}</option>)}
                        </select>
                    </div>
                case 'checkbox':
                    return <div className='flex flex-row justify-start items-center w-full'>
                        <input placeholder={config.placeholder} disabled={config.disabled} id={id} className={`focus:outline-none text-sm py-5 px-4 border border-solid border-light-gray ${config.disabled ? 'cursor-not-allowed' : 'cursor-default'} ${className || ''}`} type='checkbox' {...register(name, { ...config.validators })} />
                        <label className='px-4 text-sm' htmlFor={id}>{config.label}</label>
                    </div>
                case 'color':
                    return <div className='flex flex-col gap-2 justify-between h-full rounded border border-solid border-lighter-gray'>
                        <label htmlFor={id}>{config.label}</label>
                        <input placeholder={config.placeholder} id={id} disabled={config.disabled} autoComplete="off" className='mt-4 w-full min-h-[3rem]' type={config.type} {...register(name, { ...config.validators })} />
                    </div>
                default:
                    return <div className='relative'>
                        {config.label && <Label controlId={id} label={config.label}></Label>}
                        <input placeholder={config.placeholder} id={id} disabled={config.disabled} autoComplete="off" className={`grow w-full focus:outline-none text-sm py-5 px-4 border border-solid border-light-gray ${config.disabled ? 'cursor-not-allowed' : 'cursor-default'} ${className || ''}`} type={config.type} step={config.type === 'number' ? 'any' : undefined} {...register(name, { ...config.validators })} />
                    </div>
            }
        })()}
        <div className='text-xs text-error p-1 h-[1.5rem]'>
            {
                // formState.errors[name]
                //     ? <span>{getErrorMessage((formState.errors[name] as any), config.validators)}</span>
                //     : ' '

                <pre>{(formState.errors[name] ? formState.errors[name].message : '') as any}</pre>
            }</div>
    </div>
};
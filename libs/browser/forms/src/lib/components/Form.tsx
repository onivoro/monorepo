import { TControlRenderer, getErrorMessage } from '@onivoro/browser/forms';
import { FieldValues, UseFormReturn, useForm } from 'react-hook-form';
import { TFormFields } from '../types/form-fields.type';
import { TFormLayout } from '../types/form-layout.type';
import { useEffect } from 'react';

export function Form<TFormData>({ config, layout, value, controlRenderer, onSubmit, headerRenderer, onChange }: { config: TFormFields<TFormData>, layout: TFormLayout<TFormData>, value?: TFormData, controlRenderer?: TControlRenderer, headerRenderer?: TControlRenderer, onChange?: (_: any) => any, onSubmit: (value: TFormData, form?: UseFormReturn<FieldValues>) => any }) {

    const form = useForm({ mode: 'onTouched', values: value as any });

    useEffect(() => {
        const fieldNames = Array.from(form.control._names.mount);
        form.trigger(fieldNames);
    }, [form.control._names]);

    const currentValue = form.watch();

    function _onChange() {
        onChange?.(currentValue);
    }

    function onSubmitProxy(value: TFormData) {
        onSubmit(value, form);
    }

    return (
        <div className='flex flex-col justify-center items-stretch w-full'>
            <form onChange={_onChange} className='flex flex-col justify-center gap-4 items-stretch'
                onSubmit={form.handleSubmit(onSubmitProxy as any)}>

                {headerRenderer && headerRenderer(form.formState, form)}

                <>{layout.map((row, rowNumber) =>
                    <div key={rowNumber} className='flex flex-row justify-between items-stretch gap-12'>
                        {row.map((name: any, index: number) => {
                            if (typeof name === 'function') {
                                return <div className='flex flex-row items-center' key={index}>{name(currentValue, form?.formState, form)}</div>;
                            }
                            const fieldOptions = config[name as keyof TFormData];
                            const { label, type, validators, options, disabled, className, placeholder } = fieldOptions || {};
                            return <div className='flex-1' key={name as string}>
                                {(() => {
                                    const id = `${name}-${index}-${Date.now()}`;
                                    switch (type) {
                                        case 'select':
                                            return <div className='relative'>
                                                <Label controlId={id} label={label}></Label>
                                                <select id={id} disabled={disabled} className={`grow w-full focus:outline-none text-sm py-5 px-4 border border-solid border-light-gray ${disabled ? 'cursor-not-allowed' : 'cursor-default'} ${className || ''}`} {...form.register(name, { ...validators })}>
                                                    {(typeof options === 'function' ? options({}) : options || []).map((option, optionIndex) => <option value={option.value} key={`${name}-${optionIndex}`}>{option.display}</option>)}
                                                </select>
                                            </div>
                                        case 'checkbox':
                                            return <div className='flex flex-row justify-start items-center w-full'>
                                                <input placeholder={placeholder} disabled={disabled} id={id} className={`focus:outline-none text-sm py-5 px-4 border border-solid border-light-gray ${disabled ? 'cursor-not-allowed' : 'cursor-default'} ${className || ''}`} type='checkbox' {...form.register(name, { ...validators })} />
                                                <label className='px-4 text-sm' htmlFor={id}>{label}</label>
                                            </div>
                                        case 'color':
                                            return <div className='flex flex-col gap-2 justify-between h-full rounded border border-solid border-lighter-gray'>
                                                <label htmlFor={id}>{label}</label>
                                                <input placeholder={placeholder} id={id} disabled={disabled} autoComplete="off" className='mt-4 w-full min-h-[3rem]' type={type} {...form.register(name, { ...validators })} />
                                            </div>
                                        default:
                                            return <div className='relative'>
                                                {label && <Label controlId={id} label={label}></Label>}
                                                <input placeholder={placeholder} id={id} disabled={disabled} autoComplete="off" className={`grow w-full focus:outline-none text-sm py-5 px-4 border border-solid border-light-gray ${disabled ? 'cursor-not-allowed' : 'cursor-default'} ${className || ''}`} type={type} {...form.register(name, { ...validators })} />
                                            </div>
                                    }
                                })()}
                                <div className='text-xs text-error p-1 h-[1.5rem]'>{form.formState.errors[name] ? <span>{getErrorMessage((form.formState.errors[name] as any), validators)}</span> : ' '}</div>
                            </div>
                        })}
                    </div>
                )}</>

                {controlRenderer && controlRenderer(form.formState)}
            </form>
        </div>
    );
}


function Label({ label, controlId }: { label?: string, controlId: string }) {
    return <>{label && <label className='text-sm absolute left-[0.75rem] bg-white px-1 -translate-y-[50%] text-main-light-gray rounded z-10' htmlFor={controlId}>{label}</label>}</>;
}


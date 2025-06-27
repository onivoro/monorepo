import { TFormFields } from '../types/form-fields.type';
import { TFormLayout } from '../types/form-layout.type';
import { ChangeEventHandler, useEffect, useState } from 'react';

// TODO: DELETE THIS ONCE MANAGEDFORM.TSX IS USABLE
export function Morf<TFormData>(
    { config, layout, value, children, onChange }: {
        onChange?: (_: any) => any,
        config: TFormFields<TFormData>,
        layout: TFormLayout<TFormData>,
        value: TFormData,
        children?: any
    }) {

    const [_value, _valueSetter] = useState<TFormData>(value);
    const [_config, _configSetter] = useState<TFormFields<TFormData>>(config);
    const [_layout, _layoutSetter] = useState<TFormLayout<TFormData>>(layout);

    useEffect(() => { onChange?.(_fromFormValue(_config, value)) }, []);
    useEffect(() => {
        const _newValue = _toFormValue(_config, value);
        _valueSetter(_newValue);
    }, [value, _config]);
    useEffect(() => { _configSetter(config); }, [config]);
    useEffect(() => { _layoutSetter(layout); }, [layout]);

    const _onInputChange: ChangeEventHandler<HTMLInputElement | HTMLSelectElement> = (e) => {
        const { name, value } = e.target;

        const fromFormValue = _config[name as keyof TFormData]?.fromFormValue;

        const newValue = {
            ..._value,
            [name]: value
        };

        onChange?.({
            ..._value,
            [name]: fromFormValue ? fromFormValue(value) : value
        });

        _valueSetter(newValue);
    };

    const _onInputTypeCheckboxChange: ChangeEventHandler<HTMLInputElement | HTMLInputElement> = (e) => {
        const { name, checked } = e.target;

        const fromFormValue = _config[name as keyof TFormData]?.fromFormValue;

        const newValue = {
            ..._value,
            [name]: checked
        };

        onChange?.({
            ..._value,
            [name]: fromFormValue ? fromFormValue(checked) : checked
        });

        _valueSetter(newValue);
    };

    function _toFormValue (_config: any, value: any) {
        return {...value, ...Object.entries(_config)
        .reduce((_, [ name, fieldConfig ]: any) => {
            return {
                ..._,
                [name]: (fieldConfig.toFormValue ? (fieldConfig.toFormValue(_[name] as any) as any) : (_[name] as any))
            };
        }, {...value} as any) as TFormData };
    }

    function _fromFormValue (_config: any, value: any) {
        return {...value, ...Object.entries(_config)
        .reduce((_, [ name, fieldConfig ]: any) => {
            return {
                ..._,
                [name]: (fieldConfig.fromFormValue ? (fieldConfig.fromFormValue(_[name] as any) as any) : (_[name] as any))
            };
        }, {...value} as any) as TFormData };
    }
//
    // const _onInputTypeNumberChange: ChangeEventHandler<HTMLInputElement | HTMLSelectElement> = (e) => {
    //     const { name, value } = e.target;

    //     _onInputChange({ ...e, target: { ...e.target, value: Number(value) as any, name } })
    // };

    return (
        <div className='flex flex-col justify-center items-stretch w-full'>
            <div className='flex flex-col justify-center gap-4 items-stretch'>

                <>{_layout.map((row, rowNumber) =>
                    <div key={rowNumber} className='flex flex-row justify-between items-stretch gap-12'>
                        {row.map((name: any, index: number) => {
                            if (typeof name === 'function') {
                                return <div className='flex flex-row items-center' key={index}>{name(_value)}</div>;
                            }
                            const fieldOptions = _config[name as keyof TFormData];
                            const { label, type, validators, options, disabled, className, placeholder, multiple } = fieldOptions || {};
                            return <div className='flex-1' key={name as string}>
                                {(() => {
                                    const id = `${name}-${index}-${Date.now()}`;
                                    switch (type) {
                                        case 'select':
                                            const _options = ((typeof options === 'function') ? options(_value) : options) || [];
                                            return <div className='relative'>
                                                <Label controlId={id} label={label}></Label>
                                                <select id={id} disabled={disabled} multiple={multiple} className={`grow w-full focus:outline-none text-sm py-5 px-4 border border-solid border-light-gray ${disabled ? 'cursor-not-allowed' : 'cursor-default'} ${className || ''}`} name={name} value={(_value as any)[name]} onChange={_onInputChange}>
                                                    {_options.map((option, optionIndex) => <option value={option.value} key={`${name}-${optionIndex}`}>{option.display}</option>)}
                                                </select>
                                            </div>
                                        case 'checkbox':
                                            return <div className='flex flex-row justify-start items-center w-full'>
                                                <input placeholder={placeholder} disabled={disabled} id={id} className={`focus:outline-none text-sm py-5 px-4 border border-solid border-light-gray ${disabled ? 'cursor-not-allowed' : 'cursor-default'} ${className || ''}`} type='checkbox' name={name} checked={(_value as any)[name]} onChange={_onInputTypeCheckboxChange} />
                                                <label className='px-4 text-sm' htmlFor={id}>{label}</label>
                                            </div>
                                        case 'color':
                                            return <div className='flex flex-col gap-2 justify-between h-full rounded border border-solid border-lighter-gray'>
                                                <label htmlFor={id}>{label}</label>
                                                <input placeholder={placeholder} id={id} disabled={disabled} autoComplete="off" className='mt-4 w-full min-h-[3rem]' type={type} name={name} value={(_value as any)[name]} onChange={_onInputChange} />
                                            </div>
                                        case 'number':
                                            return <div className='relative'>
                                                {label && <Label controlId={id} label={label}></Label>}
                                                <input placeholder={placeholder} id={id} disabled={disabled} autoComplete="off" className={`grow w-full focus:outline-none text-sm py-5 px-4 border border-solid border-light-gray ${disabled ? 'cursor-not-allowed' : 'cursor-default'} ${className || ''}`} type='number' step={type === 'number' ? 'any' : undefined} name={name} value={(_value as any)[name]} onChange={_onInputChange} />
                                            </div>
                                        case 'hidden':
                                            return <div className='relative'>
                                                <input placeholder={placeholder} id={id} disabled={disabled} autoComplete="off" className={`grow w-full focus:outline-none text-sm py-5 px-4 border border-solid border-light-gray ${disabled ? 'cursor-not-allowed' : 'cursor-default'} ${className || ''}`} type='hidden' name={name} value={(_value as any)[name]} onChange={_onInputChange} />
                                            </div>
                                        case 'display':
                                            return <div className='relative'>
                                                {label && <Label controlId={id} label={label}></Label>}
                                                <div  className={`focus:outline-none text-sm py-5 px-4 border border-solid border-light-gray cursor-not-allowed bg-white ${className || ''}`}>{(_value as any)[name]}</div>
                                                <input placeholder={placeholder} id={id} disabled={disabled} autoComplete="off" className={`grow w-full focus:outline-none text-sm py-5 px-4 border border-solid border-light-gray ${disabled ? 'cursor-not-allowed' : 'cursor-default'} ${className || ''}`} type='hidden' name={name} value={(_value as any)[name]} onChange={_onInputChange} />
                                            </div>
                                        default:
                                            return <div className='relative'>
                                                {label && <Label controlId={id} label={label}></Label>}
                                                <input placeholder={placeholder} id={id} disabled={disabled} autoComplete="off" className={`grow w-full focus:outline-none text-sm py-5 px-4 border border-solid border-light-gray ${disabled ? 'cursor-not-allowed' : 'cursor-default'} ${className || ''}`} type={type} name={name} value={(_value as any)[name]} onChange={_onInputChange} />
                                            </div>
                                    }
                                })()}
                                {/* <div className='text-xs text-error p-1 h-[1.5rem]'>{form.formState.errors[name] ? <span>{getErrorMessage((form.formState.errors[name] as any), validators)}</span> : ' '}</div> */}
                            </div>
                        })}
                    </div>
                )}</>

                {children}
            </div>
        </div>
    );
}


function Label({ label, controlId }: { label?: string, controlId: string }) {
    return <>{label && <label className='text-sm absolute left-[0.75rem] bg-white px-1 -translate-y-[50%] text-main-light-gray rounded z-10' htmlFor={controlId}>{label}</label>}</>;
}


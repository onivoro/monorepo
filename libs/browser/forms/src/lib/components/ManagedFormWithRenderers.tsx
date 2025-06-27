import { TFormFields } from '../types/form-fields.type';
import { TFormLayout } from '../types/form-layout.type';
import { ChangeEventHandler, FC, PropsWithChildren, useEffect, useState } from 'react';
import { IFieldOption } from '../types/field-option.interface';

export type TManagedFormRendererProps = {
    options?: IFieldOption['options'],
    field: IFieldOption,
    name: string,
    value: any,
    id: string,
    onChange: ChangeEventHandler<HTMLInputElement | HTMLSelectElement>

};
export type TManagedFormRenderers = {
    select?: FC<PropsWithChildren<TManagedFormRendererProps>>,
    checkbox?: FC<PropsWithChildren<Omit<TManagedFormRendererProps, 'onChange'> & {onChange: ChangeEventHandler<HTMLInputElement | HTMLInputElement>}>>,
    color?: FC<PropsWithChildren<TManagedFormRendererProps>>,
    number?: FC<PropsWithChildren<TManagedFormRendererProps>>,
    hidden?: FC<PropsWithChildren<TManagedFormRendererProps>>,
    password?: FC<PropsWithChildren<TManagedFormRendererProps>>,
    display?: FC<PropsWithChildren<TManagedFormRendererProps>>,
    text?: FC<PropsWithChildren<TManagedFormRendererProps>>,
    date?: FC<PropsWithChildren<TManagedFormRendererProps>>,
    other?: FC<PropsWithChildren<TManagedFormRendererProps>>,
};

export function ManagedFormWithRenderers<TExternalData, TInternalData = any>(
    { config, layout, value, onChange, renderers }: {
        onChange?: (_: any) => any,
        config: TFormFields<TExternalData>,
        layout: TFormLayout<TExternalData>,
        value: TExternalData | undefined,
        renderers: TManagedFormRenderers,
    }) {

    const [_externalValue, _externalValueSetter] = useState<TExternalData | undefined>(value);
    // useEffect(() => { _externalValueSetter(value); }, [value]);

    const [_config, _configSetter] = useState<TFormFields<TExternalData>>(config);
    // useEffect(() => { _configSetter(config); }, [config]);

    const [_layout, _layoutSetter] = useState<TFormLayout<TExternalData>>(layout);
    // useEffect(() => { _layoutSetter(layout); }, [layout]);

    const [_internalValue, _internalValueSetter] = useState<TInternalData>();

    useEffect(() => {
        _internalValueSetter(_toFormValue(_config, _externalValue));
    }, [_config, _externalValue]);

    useEffect(() => {
        onChange?.(_fromFormValue(_config, _internalValue));
    }, [_config, _internalValue]);

    const _onInputChange: ChangeEventHandler<HTMLInputElement | HTMLSelectElement> = (e) => {
        const { name, value } = e.target;

        _internalValueSetter({
            ..._internalValue,
            [name]: value
        } as TInternalData);
    };

    const _onInputTypeCheckboxChange: ChangeEventHandler<HTMLInputElement | HTMLInputElement> = (e) => {
        const { name, checked } = e.target;

        _internalValueSetter({
            ..._internalValue,
            [name]: checked
        } as TInternalData);
    };

    function _toFormValue(__config: TFormFields<TExternalData>, __value: TExternalData | undefined) {
        return {
            ...__value, ...Object.entries(__config)
                .reduce((_, [name, fieldConfig]: any) => {
                    return {
                        ..._,
                        [name]: (fieldConfig.toFormValue ? (fieldConfig.toFormValue(_[name] as any) as any) : (_[name] as any))
                    };
                }, { ...__value } as any) as TInternalData
        };
    }

    function _fromFormValue(__config: TFormFields<TExternalData>, __value: TInternalData | undefined) {
        return {
            ...__value, ...Object.entries(__config)
                .reduce((_, [name, fieldConfig]: any) => {
                    return {
                        ..._,
                        [name]: (fieldConfig.fromFormValue ? (fieldConfig.fromFormValue(_[name] as any) as any) : (_[name] as any))
                    };
                }, { ...__value } as any) as TExternalData
        };
    }

    return (
        <div className='flex flex-col justify-center items-stretch w-full'>
            <div className='flex flex-col justify-center gap-4 items-stretch'>

                <>{_layout.map((row, rowNumber) =>
                    <div key={rowNumber} className='flex flex-row justify-between items-stretch gap-12'>
                        {row.map((name: any, index: number) => {
                            if (typeof name === 'function') {
                                return <div className='flex flex-row items-center' key={index}>{_internalValue ? name(_internalValue) : <></>}</div>;
                            }
                            const fieldOptions = _config[name as keyof TExternalData];
                            const field = fieldOptions || {};
                            const { label, type, validators, options, disabled, className, placeholder, multiple } = field;
                            return <div className='flex-1' key={name as string}>
                                {(() => {
                                    const id = `${name}-${index}-${Date.now()}`;

                                    if (!_internalValue) {
                                        return <></>;
                                    }

                                    const renderer = renderers[type] || renderers.other;

                                    return <div className={type}>{renderer!({options, onChange: type === 'checkbox' ? _onInputTypeCheckboxChange : _onInputChange, field, name, value: (_internalValue as any)[name], id})}</div>;
                                })()}
                                {/* <div className='text-xs text-error p-1 h-[1.5rem]'>{form.formState.errors[name] ? <span>{getErrorMessage((form.formState.errors[name] as any), validators)}</span> : ' '}</div> */}
                            </div>
                        })}
                    </div>
                )}</>
            </div>
        </div>
    );
}


function Label({ label, controlId }: { label?: string, controlId: string }) {
    return <>{label && <label className='text-sm absolute left-[0.75rem] bg-white px-1 -translate-y-[50%] text-main-light-gray rounded z-10' htmlFor={controlId}>{label}</label>}</>;
}


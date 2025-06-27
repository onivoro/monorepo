import { PropsWithChildren, FC, useState } from 'react';
import { Form, TControlRenderer, TFormFields, TFormLayout, formatRegexes } from '@onivoro/browser/forms';
import { TOnSubmit } from '@onivoro/browser/forms';

const className = 'text-center font-lg'

export type TCodeFormData = {
    token: string
};

export const CodeForm: FC<PropsWithChildren<{ onSubmit: TOnSubmit<TCodeFormData>, value: TCodeFormData, controlRenderer: TControlRenderer }>> = ({ onSubmit, value, children, controlRenderer }) => {
    const [layout, layoutSetter] = useState<TFormLayout<TCodeFormData>>([['token']]);
    const [config, configSetter] = useState<TFormFields<TCodeFormData>>({
        'token': { placeholder: '6 Digit Code', type: 'text', validators: { required: true, pattern: formatRegexes.code }, className },
    });

    return <>
        <Form
            value={value}
            config={config}
            layout={layout}
            onSubmit={onSubmit}
            controlRenderer={controlRenderer}
        ></Form>
        {children}
    </>;
}
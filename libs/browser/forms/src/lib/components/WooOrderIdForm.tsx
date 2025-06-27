import { PropsWithChildren, FC, useState } from 'react';
import { Form, TControlRenderer, TFormFields, TFormLayout, formatRegexes } from '@onivoro/browser/forms';
import { TOnSubmit } from '@onivoro/browser/forms';

const className = 'text-center font-lg'

export type TWooOrderIdFormData = {
    orderId: string
};

export const WooOrderIdForm: FC<PropsWithChildren<{ onSubmit: TOnSubmit<TWooOrderIdFormData>, value: TWooOrderIdFormData, controlRenderer: TControlRenderer }>> = ({ onSubmit, value, children, controlRenderer }) => {
    const [layout, layoutSetter] = useState<TFormLayout<TWooOrderIdFormData>>([['orderId']]);
    const [config, configSetter] = useState<TFormFields<TWooOrderIdFormData>>({
        'orderId': { placeholder: 'WooCommerce Order ID', type: 'number', validators: { required: true }, className },
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
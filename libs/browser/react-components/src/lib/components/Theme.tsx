import { createContext, useContext, ReactNode, useEffect, FC } from 'react';

export interface ThemeColors {
    '': string,
    primary: string;
    secondary: string;
    error: string;
    info: string;
    success: string;
    warning: string;
}

const exampleColors: ThemeColors = {
    '': '',
    primary: '',
    secondary: '',
    error: '',
    info: '',
    success: '',
    warning: '',
};

interface ThemeSpacing {
    small: string;
    medium: string;
    field: string;
    large: string;
    round: string;
}

interface Theme {
    colors: ThemeColors;
    contrast: ThemeColors;
    spacing: ThemeSpacing;
    radius: ThemeSpacing;
}

export type Variants = {
    default: string,
    text: string,
    outlined: string,
    contained: string,
    elevated: string,
};

export const variants = {
    '': '',
    text: 'text',
    outlined: 'outlined',
    contained: 'contained',
};

export type Color = keyof ThemeColors;
export type Radius = keyof ThemeSpacing;
export type Size = keyof ThemeSpacing;
export type Variant = keyof Variants;

export type ThemeableProps = {
    color?: Color;
    radius?: Size,
    size?: Size;
    variant?: Variant;
};

export const Colorator = (fn: ({ name }: { name: string }) => any) => {
    return Object.entries(exampleColors).map(([name, value]) => fn({ name }));
};

export const ColorGrid: FC<{ renderer: ({ name }: { name: Color }) => any }> = ({ renderer: fn }) => <div
    style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Object.keys(exampleColors).length}, 1fr)`,
        gridAutoRows: 'auto',
        gap: '1rem'
    }}>
    {Object.entries(exampleColors).map(([name]) => fn({ name: name as any }))}
</div>;

export const ColorList: FC<{ renderer: ({ name }: { name: Color }) => any }> = ({ renderer: fn }) => <div
    style={{
        display: 'grid',
        gap: '1rem'
    }}>
    {Object.entries(exampleColors).map(([name]) => fn({ name: name as any }))}
</div>;

export const VariantGrid: FC<{ renderer: ({ variantName, variantValue }: { variantName: string, variantValue: string }) => any }> = ({ renderer: fn }) => <div
    style={{
        display: 'grid',
        gap: '1rem'
    }}>
    {Object.entries(variants).map(([variantName, variantValue]) => fn({ variantName, variantValue }))}
</div>;

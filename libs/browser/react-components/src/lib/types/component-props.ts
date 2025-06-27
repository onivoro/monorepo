type ComponentPropsWithout<
  T extends React.ElementType,
  O extends
    | Omit<string, keyof React.ComponentPropsWithoutRef<T>>
    | keyof React.ComponentPropsWithoutRef<T>
> = Omit<React.ComponentPropsWithoutRef<T>, O & string>;

export type { ComponentPropsWithout };

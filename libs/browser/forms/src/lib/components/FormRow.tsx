import { FC, PropsWithChildren } from 'react';

export const FormRow: FC<PropsWithChildren> = ({ children }) => {

    return <div className='flex flex-row justify-between items-stretch gap-12'>
        {children}
    </div>;
};

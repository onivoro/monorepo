

export function Label({ label, controlId }: { label?: string, controlId: string }) {
    return <>{label && <label className='text-sm absolute left-[0.75rem] bg-white px-1 -translate-y-[50%] text-main-light-gray rounded z-10' htmlFor={controlId}>{label}</label>}</>;
}


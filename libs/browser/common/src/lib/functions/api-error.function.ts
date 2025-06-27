import { IAxiosWrappedNestException } from "../types/axios-wrapped-nest-exception.interface";

export function apiError(e: IAxiosWrappedNestException) {
    if (!e) {
        return 'An error occurred. Please try again.';
    }

    if (e?.message && (e?.message[0] as any)?.message) {
        return (e?.message[0] as any)?.message;
    }

    return e?.message;
}


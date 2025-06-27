import { IAccessToken } from "@onivoro/isomorphic/common";
import { createAuthParamDecorator } from "../functions/create-auth-param-decorator.function";

export type TIds = {
    brokerId?: string,
    companyId?: string,
};

export const Ids = createAuthParamDecorator<IAccessToken>(token => {
    const ids: Record<string, string> = {};

    if (token) {
        const { brokerId, companyId } = token;

        if (brokerId) {
            ids['brokerId'] = brokerId;
        }

        if (companyId) {
            ids['companyId'] = companyId;
        }
    }

    return ids;
});
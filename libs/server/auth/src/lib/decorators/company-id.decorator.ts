import { IAccessToken } from "@onivoro/isomorphic/common";
import { createAuthParamDecorator } from "../functions/create-auth-param-decorator.function";

export const CompanyId = createAuthParamDecorator<IAccessToken>(token => token.companyId);
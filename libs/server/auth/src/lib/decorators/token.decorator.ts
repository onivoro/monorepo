import { IAccessToken } from "@onivoro/isomorphic/common";
import { createAuthParamDecorator } from "../functions/create-auth-param-decorator.function";

export const Token = createAuthParamDecorator<IAccessToken>(token => token);
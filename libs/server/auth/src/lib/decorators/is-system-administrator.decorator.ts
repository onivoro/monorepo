import { RoleEnum } from "@onivoro/server/b2b-orm";
import { IAccessToken } from "@onivoro/isomorphic/common";
import { createAuthParamDecorator } from "../functions/create-auth-param-decorator.function";

export const IsSystemAdministrator = createAuthParamDecorator<IAccessToken>(token => token.roleId === RoleEnum.SYSTEM_ADMIN);
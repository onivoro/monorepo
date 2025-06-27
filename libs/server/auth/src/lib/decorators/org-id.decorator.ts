import { createAuthParamDecorator } from "../functions/create-auth-param-decorator.function";

export const OrgId = createAuthParamDecorator<{ orgId: boolean }>(token => token && token.orgId);

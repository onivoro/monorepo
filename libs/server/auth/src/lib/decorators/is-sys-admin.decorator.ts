import { createAuthParamDecorator } from '../functions/create-auth-param-decorator.function';

export const IsSysAdmin = createAuthParamDecorator<{ isSysAdmin: boolean }>(token => token && token.isSysAdmin);

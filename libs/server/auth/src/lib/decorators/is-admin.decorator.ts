import { createAuthParamDecorator } from '../functions/create-auth-param-decorator.function';

export const IsAdmin = createAuthParamDecorator<{ isAdmin: boolean }>(token => token && token.isAdmin);

export * from './lib/server-aws-cognito-config.class';
export * from './lib/server-aws-cognito.module';
export * from './lib/server-aws-cognito-oidc-config.class';
export * from './lib/server-aws-cognito-oidc.module';

export * from './lib/classes/abstract-auth-guard.class';

export * from './lib/constants/access-token-key.constant';
export * from './lib/constants/id-token-key.constant';
export * from './lib/constants/request-user-key.constant';

export * from './lib/decorators/access-token-header.decorator';
export * from './lib/decorators/email.decorator';
export * from './lib/decorators/id-token.decorator';
export * from './lib/decorators/request-user.decorator';

export * from './lib/dtos/claim-response.dto';
export * from './lib/dtos/oidc-client-config-metadata.dto';
export * from './lib/dtos/oidc-client-config.dto';
export * from './lib/dtos/cognito-saml-client-config.dto';
export * from './lib/dtos/cognito-saml-idp-config.dto';
export * from './lib/dtos/tokens.dto';

export * from './lib/functions/authorize-request.function';
export * from './lib/functions/extract-origin.function';
export * from './lib/functions/format-claim-overrides.function';
export * from './lib/functions/get-oidc-user.function';
export * from './lib/functions/get-token-issuer-url.function';
export * from './lib/functions/get-token-signing-key-url.function';
export * from './lib/functions/get-token-signing-url.function';
export * from './lib/functions/oidc-client-config-factory.function';
export * from './lib/functions/oidc-entra-config-factory.function';

export * from './lib/guards/has-token.guard';

export * from './lib/middlewares/oidc-auth.middleware';

export * from './lib/services/cognito-refresh-token.service';
export * from './lib/services/cognito-token-validator.service';
export * from './lib/services/cognito-user.service';
export * from './lib/services/cookie.service';
export * from './lib/services/user-hydrater.service';

export * from './lib/types/cognito-attribute.type';
export * from './lib/types/cognito-jwk.type';
export * from './lib/types/cognito-identity-token.interface';
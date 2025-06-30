import { Module } from '@nestjs/common';

import { moduleFactory, ServerCommonModule } from '@onivoro/server-common';

import { LoginController } from './controllers/login.controller';
import { LoginService } from './services/login.service';
import { TokenValidationService } from './services/token-validation.service';
import { ServerAuthConfig } from './classes/server-auth-config.class';
import { TokenBuilder } from './classes/token-builder.class';
import { TotpService } from './services/totp.service';
import { TotpController } from './controllers/totp.controller';
import { MfaLoginService } from './services/mfa-login.service';
import { MfaLoginController } from './controllers/mfa-login.controller';

const controllers = [
  MfaLoginController,
  LoginController,
  TotpController,
];

const imports = [
  ServerCommonModule,
];

const providers = [
  TokenBuilder,
  TotpService,
];

@Module({
  providers,
  imports
})
export class ServerAuthModule {
  static configure<TAccessToken>(
    config: ServerAuthConfig,
  ) {
    return moduleFactory({
      module: ServerAuthModule,
      controllers,
      imports,
      providers: [
        ...providers,
        LoginService,
        MfaLoginService,
        TokenValidationService,
        {
          provide: ServerAuthConfig,
          useValue: config
        },
      ],
    })
  }
}

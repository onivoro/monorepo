import { Module } from '@nestjs/common';
import { ServerCommonModule } from '@onivoro/server/common';
import { moduleFactory } from '@onivoro/server/common';
import { ServerAuthModule } from './server-auth.module';
import { IdentityController } from './controllers/identity.controller';
import { ServerSendgridModule } from '@onivoro/server/sendgrid';
import { LibServerAuthConfig } from './lib-server-auth-config.class';

@Module({})
export class LibServerAuthModule {
  static configure(config: LibServerAuthConfig) {
    return moduleFactory({
      module: LibServerAuthModule,
      imports: [
        ServerCommonModule,
        ServerAuthModule.configure({
          JWT_SECRET: config.JWT_SECRET,
          expiresIn: '3hr',
          issuer: config.UI_URL.split('://')[1]
        }),
        ServerSendgridModule.configure({
          SENDGRID_API_KEY: config.SENDGRID_API_KEY,
          FROM: config.SENDGRID_FROM_ADDRESS
        }),
      ],
      controllers: [
        IdentityController,
      ],
    })
  }
}
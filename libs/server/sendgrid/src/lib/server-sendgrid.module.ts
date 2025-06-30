import { Module } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { ServerSendgridConfig } from './classes/server-sendgrid-config.class';
import { moduleFactory } from '@onivoro/server-common';
import sgMail, { MailService } from '@sendgrid/mail';

let mailSvc: MailService | null = null;

@Module({})
export class ServerSendgridModule {
  static configure(config: ServerSendgridConfig) {
    return moduleFactory({
      module: ServerSendgridModule,
      providers: [
        { provide: ServerSendgridConfig, useValue: config },
        {
          provide: MailService,
          useFactory: () => {
            if(!mailSvc) {
              mailSvc = sgMail;
              sgMail.setApiKey(config.SENDGRID_API_KEY);
            }

            return mailSvc;
          }
        },
        EmailService
      ]
    });
  }
}

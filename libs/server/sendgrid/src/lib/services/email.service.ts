import { Injectable } from '@nestjs/common';
import { ServerSendgridConfig } from '../classes/server-sendgrid-config.class';
import { MailService } from '@sendgrid/mail';

@Injectable()
export class EmailService {
  constructor(public config: ServerSendgridConfig, private sgMail: MailService) { }

  async sendEmail(to: string, subject: string, html: string, text: string) {
    return await this.sgMail
      .send({
        to,
        from: this.config.FROM,
        subject,
        text,
        html,
      });
  }
}

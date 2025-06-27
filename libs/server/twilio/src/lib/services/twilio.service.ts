
import { Injectable } from '@nestjs/common';
import { Twilio } from 'twilio';
import { ServerTwilioConfig } from '../classes/server-twilio-config.class';

@Injectable()
export class TwilioService {
  constructor(public config: ServerTwilioConfig, private twilioClient: Twilio) {}

  async sendSms(to: string, body: string) {
    try {
      const { TWILIO_FROM: from } = this.config;
      await this.twilioClient.messages.create({ body, from, to });
    } catch (error) {
      console.error({
        error,
        msg: `failed to send sms to ${to}`,
      });

      throw error;
    }
  }
}

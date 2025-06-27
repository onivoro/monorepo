import { Injectable } from "@nestjs/common";
import { Twilio } from "twilio";

@Injectable()
export class SmsService {
    constructor(private twilio: Twilio) {}

    async index(to: string, limit = 100) {
        const messages = await this.twilio.messages.list({
          to,
          limit,
        });
        return messages; //[0].body.match(/\d{6}/)[0]; // Assuming the SMS contains a 6-digit verification code.
      }
}
import { Test } from '@nestjs/testing';
import { Twilio } from 'twilio';
import { ServerTwilioModule } from './api-twilio.module';
import { ServerTwilioConfig } from './classes/server-twilio-config.class';
import { SmsService } from './services/sms.service';
import { TwilioService } from './services/twilio.service';

jest.mock('twilio', () => {
  class Twilio {
    messages = {
      create: jest.fn().mockResolvedValue({}),
      list: jest.fn().mockResolvedValue([]),
    };
    constructor(
      public sid: string,
      public token: string,
    ) {}
  }
  return { Twilio };
});

describe('ServerTwilioModule', () => {
  it('builds one Twilio client from the config and shares it between the services', async () => {
    const config = new ServerTwilioConfig('AC123', 'secret', '+15550000000');
    const moduleRef = await Test.createTestingModule({
      imports: [ServerTwilioModule.configure(config)],
    }).compile();

    const client = moduleRef.get(Twilio) as unknown as {
      sid: string;
      token: string;
      messages: { create: jest.Mock; list: jest.Mock };
    };
    const twilioService = moduleRef.get(TwilioService);

    expect(client.sid).toBe('AC123');
    expect(client.token).toBe('secret');
    expect(twilioService.config).toBe(config);

    await twilioService.sendSms('+15551111111', 'hi');
    expect(client.messages.create).toHaveBeenCalledWith({
      body: 'hi',
      from: '+15550000000',
      to: '+15551111111',
    });

    await moduleRef.get(SmsService).index('+15551111111');
    expect(client.messages.list).toHaveBeenCalledWith({
      to: '+15551111111',
      limit: 100,
    });
  });
});

import { Twilio } from 'twilio';
import { ServerTwilioConfig } from '../classes/server-twilio-config.class';
import { TwilioService } from './twilio.service';

describe('TwilioService', () => {
  const config = new ServerTwilioConfig('AC123', 'token', '+15550000000');

  function createService() {
    const client = {
      messages: { create: jest.fn().mockResolvedValue({ sid: 'SM1' }) },
    };
    const service = new TwilioService(config, client as unknown as Twilio);
    return { service, client };
  }

  afterEach(() => jest.restoreAllMocks());

  it('sends the sms from the configured number', async () => {
    const { service, client } = createService();

    await expect(
      service.sendSms('+15551111111', 'hello'),
    ).resolves.toBeUndefined();

    expect(client.messages.create).toHaveBeenCalledWith({
      body: 'hello',
      from: '+15550000000',
      to: '+15551111111',
    });
  });

  it('logs and rethrows when twilio rejects', async () => {
    const { service, client } = createService();
    const error = new Error('invalid number');
    client.messages.create.mockRejectedValue(error);
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(service.sendSms('bad', 'hello')).rejects.toBe(error);

    expect(errorSpy).toHaveBeenCalledWith({
      error,
      msg: 'failed to send sms to bad',
    });
  });
});

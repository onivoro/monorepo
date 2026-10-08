import { Twilio } from 'twilio';
import { SmsService } from './sms.service';

describe('SmsService', () => {
  function createService() {
    const client = {
      messages: {
        list: jest.fn().mockResolvedValue([{ body: 'code 123456' }]),
      },
    };
    return { service: new SmsService(client as unknown as Twilio), client };
  }

  it('lists messages sent to a number with a default limit of 100', async () => {
    const { service, client } = createService();

    const result = await service.index('+15551111111');

    expect(result).toEqual([{ body: 'code 123456' }]);
    expect(client.messages.list).toHaveBeenCalledWith({
      to: '+15551111111',
      limit: 100,
    });
  });

  it('honours an explicit limit', async () => {
    const { service, client } = createService();

    await service.index('+15551111111', 5);

    expect(client.messages.list).toHaveBeenCalledWith({
      to: '+15551111111',
      limit: 5,
    });
  });

  it('propagates client failures', async () => {
    const { service, client } = createService();
    client.messages.list.mockRejectedValue(new Error('nope'));

    await expect(service.index('x')).rejects.toThrow('nope');
  });
});

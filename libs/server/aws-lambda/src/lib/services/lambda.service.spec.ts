import {
  InvocationType,
  InvokeCommand,
  LambdaClient,
} from '@aws-sdk/client-lambda';
import { LambdaService } from './lambda.service';

describe(LambdaService.name, () => {
  const encode = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value));

  const setup = (Payload?: Uint8Array) => {
    const send = jest.fn().mockResolvedValue({ Payload });
    const service = new LambdaService({ send } as unknown as LambdaClient);
    return { send, service };
  };

  describe('invoke', () => {
    it('decodes the Uint8Array payload and returns the parsed body', async () => {
      const { service } = setup(
        encode({ statusCode: 200, body: JSON.stringify({ id: 7, name: 'x' }) }),
      );

      expect(await service.invoke({ id: 7 }, 'get-thing')).toEqual({
        id: 7,
        name: 'x',
      });
    });

    it('sends RequestResponse by default with the JSON event as payload', async () => {
      const { send, service } = setup(encode({ body: '{}' }));

      await service.invoke({ a: 1 }, 'fn');

      const command: InvokeCommand = send.mock.calls[0][0];
      expect(command.input).toEqual({
        FunctionName: 'fn',
        InvocationType: InvocationType.RequestResponse,
        Payload: JSON.stringify({ a: 1 }, null, 2),
      });
    });

    it('accepts other invocation types', async () => {
      const { send, service } = setup(new Uint8Array());

      expect(await service.invoke({}, 'fn', InvocationType.Event)).toBeNull();
      expect(send.mock.calls[0][0].input.InvocationType).toBe(
        InvocationType.Event,
      );
    });

    it.each([
      ['no payload', undefined],
      ['no body', encode({ statusCode: 200 })],
      ['non-JSON body', encode({ body: 'nope' })],
    ])('returns null when there is %s', async (_, payload) => {
      const { service } = setup(payload);

      expect(await service.invoke({}, 'fn')).toBeNull();
    });
  });
});

import { chainHandler } from './chain-handler';

describe('chainHandler', () => {
  it('calls the new handler, then the previous one, with the same arguments', () => {
    const calls: string[] = [];
    const target: { onerror?: (error: Error) => void } = {
      onerror: (error) => calls.push(`previous ${error.message}`),
    };

    chainHandler(target, 'onerror', (error) =>
      calls.push(`new ${error.message}`),
    );
    target.onerror?.(new Error('boom'));

    expect(calls).toEqual(['new boom', 'previous boom']);
  });

  it('works when nothing was set before', () => {
    const target: { onclose?: () => void } = {};
    const handler = jest.fn();

    chainHandler(target, 'onclose', handler);
    target.onclose?.();

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

import { isJsonRpcNotification } from './jsonrpc-notification';

describe('isJsonRpcNotification', () => {
  it('accepts a notification with params', () => {
    expect(
      isJsonRpcNotification({ jsonrpc: '2.0', method: 'a', params: { x: 1 } }),
    ).toBe(true);
  });

  it('accepts a notification without params', () => {
    expect(isJsonRpcNotification({ jsonrpc: '2.0', method: 'a' })).toBe(true);
  });

  it('rejects a request (has an id)', () => {
    expect(isJsonRpcNotification({ jsonrpc: '2.0', method: 'a', id: 1 })).toBe(
      false,
    );
  });

  it('rejects a message whose id key is present but undefined', () => {
    expect(
      isJsonRpcNotification({ jsonrpc: '2.0', method: 'a', id: undefined }),
    ).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'notification'],
    ['a number', 42],
    ['missing jsonrpc', { method: 'a' }],
    ['wrong version', { jsonrpc: '1.0', method: 'a' }],
    ['missing method', { jsonrpc: '2.0' }],
    ['non-string method', { jsonrpc: '2.0', method: 7 }],
    ['a response', { jsonrpc: '2.0', id: 1, result: 'ok' }],
  ])('rejects %s', (_label, message) => {
    expect(isJsonRpcNotification(message)).toBe(false);
  });
});

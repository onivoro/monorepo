import {
  createStdioLogNotification,
  isStdioLogNotification,
  STDIO_LOG_METHOD,
} from './stdio-log-message';

describe('createStdioLogNotification', () => {
  it('wraps params in a JSON-RPC log notification', () => {
    const params = {
      level: 'warn' as const,
      message: 'careful',
      timestamp: '2026-01-01T00:00:00.000Z',
    };

    expect(STDIO_LOG_METHOD).toBe('log');
    expect(createStdioLogNotification(params)).toEqual({
      jsonrpc: '2.0',
      method: 'log',
      params,
    });
  });
});

describe('isStdioLogNotification', () => {
  it('accepts what createStdioLogNotification produces', () => {
    expect(
      isStdioLogNotification(
        createStdioLogNotification({
          level: 'info',
          message: 'hi',
          timestamp: 't',
        }),
      ),
    ).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'log'],
    [
      'missing jsonrpc',
      { method: 'log', params: { level: 'info', message: '' } },
    ],
    [
      'the wrong version',
      { jsonrpc: '1.0', method: 'log', params: { level: 'info', message: '' } },
    ],
    [
      'another method',
      {
        jsonrpc: '2.0',
        method: 'other',
        params: { level: 'info', message: '' },
      },
    ],
    [
      'missing method',
      { jsonrpc: '2.0', params: { level: 'info', message: '' } },
    ],
    ['missing params', { jsonrpc: '2.0', method: 'log' }],
    ['null params', { jsonrpc: '2.0', method: 'log', params: null }],
    ['string params', { jsonrpc: '2.0', method: 'log', params: 'x' }],
    [
      'params without level',
      { jsonrpc: '2.0', method: 'log', params: { message: '' } },
    ],
    [
      'params without message',
      { jsonrpc: '2.0', method: 'log', params: { level: 'info' } },
    ],
  ])('rejects %s', (_label, message) => {
    expect(isStdioLogNotification(message)).toBe(false);
  });
});

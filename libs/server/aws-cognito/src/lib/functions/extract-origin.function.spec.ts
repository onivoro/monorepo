import { extractOrigin } from './extract-origin.function';

function res({
  header,
  reqHeaders,
}: {
  header?: string;
  reqHeaders?: Record<string, string>;
} = {}): any {
  return {
    getHeader: jest.fn().mockReturnValue(header),
    req: reqHeaders ? { headers: reqHeaders } : undefined,
  };
}

describe(extractOrigin.name, () => {
  it('returns the override verbatim when given', () => {
    const response = res({ header: 'https://ignored.example.com' });

    expect(extractOrigin(response, 'https://override.example.com/x/')).toBe(
      'https://override.example.com/x/',
    );
    expect(response.getHeader).not.toHaveBeenCalled();
  });

  it('prefers the origin header on the response', () => {
    expect(
      extractOrigin(
        res({
          header: 'https://res.example.com',
          reqHeaders: { origin: 'https://req.example.com' },
        }),
      ),
    ).toBe('https://res.example.com');
  });

  it('falls back to the request origin header', () => {
    expect(
      extractOrigin(res({ reqHeaders: { origin: 'https://req.example.com' } })),
    ).toBe('https://req.example.com');
  });

  it('falls back to the referer and strips its path', () => {
    expect(
      extractOrigin(
        res({
          reqHeaders: { referer: 'https://app.example.com:8443/a/b?c=d' },
        }),
      ),
    ).toBe('https://app.example.com:8443');
  });

  it('strips a trailing slash', () => {
    expect(
      extractOrigin(res({ reqHeaders: { origin: 'http://localhost:4200/' } })),
    ).toBe('http://localhost:4200');
  });

  it('works when the response has no getHeader function', () => {
    expect(
      extractOrigin({
        req: { headers: { origin: 'https://req.example.com' } },
      } as any),
    ).toBe('https://req.example.com');
  });

  it('returns the value as-is when it is not a parseable URL', () => {
    expect(extractOrigin(res({ reqHeaders: { origin: 'not a url/' } }))).toBe(
      'not a url',
    );
  });

  it('returns an empty string when no origin can be found', () => {
    expect(extractOrigin(res())).toBe('');
    expect(extractOrigin(res({ reqHeaders: {} }))).toBe('');
  });
});

import { sign } from 'jsonwebtoken';
import { CookieService } from './cookie.service';

const config = {
  AWS_REGION: 'us-east-1',
  COGNITO_USER_POOL_ID: 'us-east-1_pool',
  COGNITO_USER_POOL_CLIENT_ID: 'client-id',
  COGNITO_DOMAIN_PREFIX: 'prefix',
};

const prefix = 'prefix___us-east-1___client-id___';
const now = new Date('2026-01-01T00:00:00Z');
const nowSeconds = Math.floor(now.getTime() / 1000);

function mockResponse(origin?: string): any {
  return {
    getHeader: jest.fn().mockReturnValue(undefined),
    req: { headers: origin ? { origin } : {} },
    cookie: jest.fn(),
  };
}

function jwtExpiringIn(seconds: number) {
  return sign({ exp: nowSeconds + seconds }, 'secret');
}

describe(CookieService.name, () => {
  let service: CookieService;

  beforeEach(() => {
    jest.useFakeTimers({ now });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service = new CookieService(config);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('getTokenFullName', () => {
    it('namespaces the token name by domain prefix, region and client id', () => {
      expect(service.getTokenFullName('id_token')).toBe(`${prefix}id_token`);
    });
  });

  describe('get', () => {
    it('reads the namespaced cookie from the request', () => {
      const req: any = { cookies: { [`${prefix}refresh_token`]: 'r' } };

      expect(service.get(req, 'refresh_token')).toBe('r');
      expect(service.get(req, 'id_token')).toBeUndefined();
    });

    it('returns undefined when the request has no cookies', () => {
      expect(service.get({} as any, 'id_token')).toBeUndefined();
      expect(service.get(undefined as any, 'id_token')).toBeUndefined();
    });
  });

  describe('setCookies', () => {
    it('sets insecure, lax, domain-less cookies for localhost', () => {
      const res = mockResponse('http://localhost:4200');

      service.setCookies(res, { id_token: 'opaque' } as any);

      expect(res.cookie).toHaveBeenCalledTimes(1);
      expect(res.cookie).toHaveBeenCalledWith(`${prefix}id_token`, 'opaque', {
        httpOnly: true,
        secure: false,
        sameSite: false,
        path: '/api',
      });
    });

    it('treats 127.0.0.1 as local', () => {
      const res = mockResponse('http://127.0.0.1:3000');

      service.setCookies(res, { id_token: 'opaque' } as any);

      expect(res.cookie.mock.calls[0][2]).toEqual({
        httpOnly: true,
        secure: false,
        sameSite: false,
        path: '/api',
      });
    });

    it('scopes cookies to the registrable domain for remote origins', () => {
      const res = mockResponse('https://app.foo.example.com');

      service.setCookies(res, { id_token: 'opaque' } as any);

      expect(res.cookie.mock.calls[0][2]).toEqual({
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/api',
        domain: '.example.com',
      });
    });

    it.each([
      ['https://www.example.co.uk', '.example.co.uk'],
      ['https://a.b.example.com.au:8443', '.example.com.au'],
    ])('keeps three labels for double-barrel TLD %s', (origin, domain) => {
      const res = mockResponse(origin);

      service.setCookies(res, { id_token: 'opaque' } as any);

      expect(res.cookie.mock.calls[0][2].domain).toBe(domain);
    });

    it('omits the domain for a single-label remote host but stays secure', () => {
      const res = mockResponse('https://intranet');

      service.setCookies(res, { id_token: 'opaque' } as any);

      expect(res.cookie.mock.calls[0][2]).toEqual({
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/api',
      });
    });

    it('sets maxAge from the JWT exp claim', () => {
      const res = mockResponse('http://localhost');

      service.setCookies(res, { id_token: jwtExpiringIn(3600) } as any);

      expect(res.cookie.mock.calls[0][2].maxAge).toBe(3600 * 1000);
    });

    it('leaves maxAge undefined for an already-expired JWT', () => {
      const res = mockResponse('http://localhost');

      service.setCookies(res, { id_token: jwtExpiringIn(-10) } as any);

      expect(res.cookie.mock.calls[0][2]).toHaveProperty('maxAge', undefined);
    });

    it('sets every provided token and skips missing ones', () => {
      const res = mockResponse('http://localhost');

      service.setCookies(res, {
        id_token: 'id',
        access_token: 'access',
      } as any);

      expect(res.cookie.mock.calls.map((c: any[]) => [c[0], c[1]])).toEqual([
        [`${prefix}id_token`, 'id'],
        [`${prefix}access_token`, 'access'],
      ]);
    });

    it('logs and continues when setting one cookie fails', () => {
      const res = mockResponse('http://localhost');
      res.cookie.mockImplementationOnce(() => {
        throw new Error('boom');
      });

      service.setCookies(res, {
        id_token: 'id',
        refresh_token: 'refresh',
      } as any);

      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('error setting cookie id_token'),
        'boom',
      );
    });

    it('logs and sets nothing when the origin cannot be determined', () => {
      const res: any = {
        getHeader: () => {
          throw new Error('headers sent');
        },
        cookie: jest.fn(),
      };

      expect(() =>
        service.setCookies(res, { id_token: 'id' } as any),
      ).not.toThrow();
      expect(res.cookie).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('error determining domain');
    });
  });
});

import { OidcAuthMiddleware } from './oidc-auth.middleware';
import { OidcIdTokenMiddleware } from './oidc-id-token.middleware';
import { idTokenKey } from '../constants/id-token-key.constant';
import { requestUserKey } from '../constants/request-user-key.constant';

const config: any = {
  AWS_REGION: 'us-east-1',
  COGNITO_USER_POOL_ID: 'pool',
  COGNITO_USER_POOL_CLIENT_ID: 'client-id',
  COGNITO_DOMAIN_PREFIX: 'prefix',
};

describe.each([OidcAuthMiddleware, OidcIdTokenMiddleware])(
  '%p',
  (Middleware) => {
    afterEach(() => jest.restoreAllMocks());

    it('refreshes through /oauth2/token when the id token has expired', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => undefined);
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const expired = Object.assign(new Error('jwt expired'), {
        name: 'TokenExpiredError',
      });
      const validator: any = {
        validate: jest
          .fn()
          .mockRejectedValueOnce(expired)
          .mockResolvedValueOnce({ email: 'user@example.com' }),
      };
      const cookies: Record<string, string> = {
        id_token: 'old-id',
        refresh_token: 'refresh',
      };
      const cookieService: any = {
        get: jest.fn((_: any, key: string) => cookies[key]),
        setCookies: jest.fn(),
      };
      const hydrater: any = {
        hydrateUserByEmail: jest.fn().mockResolvedValue({ id: 1 }),
      };
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id_token: 'new-id' }),
      });
      global.fetch = fetchMock as any;
      const req: any = { method: 'GET', url: '/api/thing', headers: {} };
      const res: any = {};

      await new Middleware(
        validator,
        config,
        hydrater,
        cookieService,
      ).authorizeAndHydrateUser(req, res);

      expect(validator.validate).toHaveBeenNthCalledWith(1, 'old-id', {
        throwOnExpired: true,
      });
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://prefix.auth.us-east-1.amazoncognito.com/oauth2/token',
      );
      expect(fetchMock.mock.calls[0][1].body).toBe(
        'grant_type=refresh_token&client_id=client-id&refresh_token=refresh',
      );
      expect(validator.validate).toHaveBeenNthCalledWith(2, 'new-id');
      expect(cookieService.setCookies).toHaveBeenCalledWith(res, {
        id_token: 'new-id',
      });
      expect(req[idTokenKey]).toEqual({ email: 'user@example.com' });
      expect(req[requestUserKey]).toEqual({ id: 1 });
    });

    describe('more cases', () => {
      const originalFetch = global.fetch;
      let validator: any;
      let cookies: Record<string, string>;
      let cookieService: any;
      let hydrater: any;
      let fetchMock: jest.Mock;
      let middleware: InstanceType<typeof Middleware>;
      const expired = () =>
        Object.assign(new Error('jwt expired'), { name: 'TokenExpiredError' });

      beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        validator = { validate: jest.fn() };
        cookies = {};
        cookieService = {
          get: jest.fn((_: any, key: string) => cookies[key]),
          setCookies: jest.fn(),
        };
        hydrater = {
          hydrateUserByEmail: jest.fn().mockResolvedValue({ id: 1 }),
        };
        fetchMock = jest.fn();
        global.fetch = fetchMock as any;
        middleware = new Middleware(validator, config, hydrater, cookieService);
      });

      afterEach(() => {
        global.fetch = originalFetch;
      });

      const request = (url = '/api/thing'): any => ({
        method: 'GET',
        url,
        headers: {},
      });

      it('exposes idTokenKey statically', () => {
        expect(Middleware.idTokenKey).toBe(idTokenKey);
      });

      describe('use', () => {
        it.each(['/api/thing', '/v1/api/x'])(
          'authorizes %s and calls next',
          async (url) => {
            const spy = jest
              .spyOn(middleware, 'authorizeAndHydrateUser')
              .mockResolvedValue(undefined);
            const next = jest.fn();
            const req = request(url);

            await middleware.use(req, {} as any, next);

            expect(spy).toHaveBeenCalledWith(req, {});
            expect(next).toHaveBeenCalledTimes(1);
          },
        );

        it.each(['/api/health', '/assets/main.js', '/'])(
          'skips authorization for %s but still calls next',
          async (url) => {
            const spy = jest.spyOn(middleware, 'authorizeAndHydrateUser');
            const next = jest.fn();

            await middleware.use(request(url), {} as any, next);

            expect(spy).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledTimes(1);
          },
        );
      });

      describe('authorizeAndHydrateUser', () => {
        it('leaves the request anonymous when there is no id token cookie', async () => {
          const req = request();

          await middleware.authorizeAndHydrateUser(req, {} as any);

          expect(validator.validate).not.toHaveBeenCalled();
          expect(req[idTokenKey]).toBeUndefined();
          expect(req[requestUserKey]).toBeUndefined();
          expect(hydrater.hydrateUserByEmail).not.toHaveBeenCalled();
        });

        it('validates the id token cookie and hydrates the user by email', async () => {
          cookies.id_token = 'id';
          validator.validate.mockResolvedValue({ email: 'a@example.com' });
          const req = request();

          await middleware.authorizeAndHydrateUser(req, {} as any);

          expect(cookieService.get).toHaveBeenCalledWith(req, 'id_token');
          expect(req[idTokenKey]).toEqual({ email: 'a@example.com' });
          expect(hydrater.hydrateUserByEmail).toHaveBeenCalledWith(
            'a@example.com',
          );
          expect(req[requestUserKey]).toEqual({ id: 1 });
          expect(fetchMock).not.toHaveBeenCalled();
        });

        it('does not hydrate when the id token is invalid', async () => {
          cookies.id_token = 'bad';
          validator.validate.mockResolvedValue(undefined);
          const req = request();

          await middleware.authorizeAndHydrateUser(req, {} as any);

          expect(req[idTokenKey]).toBeUndefined();
          expect(hydrater.hydrateUserByEmail).not.toHaveBeenCalled();
        });

        it('logs and leaves the user unset when hydration fails', async () => {
          cookies.id_token = 'id';
          validator.validate.mockResolvedValue({ email: 'a@example.com' });
          hydrater.hydrateUserByEmail.mockRejectedValue(new Error('db down'));
          const req = request();

          await expect(
            middleware.authorizeAndHydrateUser(req, {} as any),
          ).resolves.toBeUndefined();

          expect(req[idTokenKey]).toEqual({ email: 'a@example.com' });
          expect(req[requestUserKey]).toBeUndefined();
          expect(console.error).toHaveBeenCalledWith(
            'Failed to hydrate user by email',
            expect.objectContaining({
              email: 'a@example.com',
              error: 'db down',
            }),
          );
        });

        it('does not refresh on validation errors other than expiry', async () => {
          cookies.id_token = 'id';
          cookies.refresh_token = 'refresh';
          validator.validate.mockRejectedValue(new Error('other'));
          const req = request();

          await middleware.authorizeAndHydrateUser(req, {} as any);

          expect(fetchMock).not.toHaveBeenCalled();
          expect(req[idTokenKey]).toBeUndefined();
          expect(hydrater.hydrateUserByEmail).not.toHaveBeenCalled();
        });

        it('warns and does not refresh when there is no refresh token', async () => {
          cookies.id_token = 'id';
          validator.validate.mockRejectedValue(expired());
          const req = request();

          await middleware.authorizeAndHydrateUser(req, {} as any);

          expect(fetchMock).not.toHaveBeenCalled();
          expect(console.warn).toHaveBeenCalledWith(
            'Token expired but no refresh token available',
            expect.objectContaining({ hasRefreshToken: false }),
          );
          expect(req[idTokenKey]).toBeUndefined();
        });

        it('posts a form-encoded refresh request to the token endpoint', async () => {
          cookies.id_token = 'id';
          cookies.refresh_token = 'refresh';
          validator.validate.mockRejectedValue(expired());
          fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({}),
          });

          await middleware.authorizeAndHydrateUser(request(), {} as any);

          expect(fetchMock).toHaveBeenCalledWith(
            'https://prefix.auth.us-east-1.amazoncognito.com/oauth2/token',
            expect.objectContaining({
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            }),
          );
        });

        it('clears the request identity when the refresh request fails', async () => {
          cookies.id_token = 'id';
          cookies.refresh_token = 'refresh';
          validator.validate.mockRejectedValue(expired());
          fetchMock.mockResolvedValue({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            text: async () => 'invalid_grant',
          });
          const req = request();
          req[requestUserKey] = { stale: true };
          req[idTokenKey] = { stale: true };

          await middleware.authorizeAndHydrateUser(req, {} as any);

          expect(req[idTokenKey]).toBeUndefined();
          expect(req[requestUserKey]).toBeUndefined();
          expect(cookieService.setCookies).not.toHaveBeenCalled();
          expect(console.error).toHaveBeenCalledWith(
            'Token refresh request failed',
            expect.objectContaining({
              statusCode: 400,
              errorBody: 'invalid_grant',
            }),
          );
        });

        it('does not set cookies when the refresh response has no id token', async () => {
          cookies.id_token = 'id';
          cookies.refresh_token = 'refresh';
          validator.validate.mockRejectedValue(expired());
          fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ access_token: 'a' }),
          });
          const req = request();

          await middleware.authorizeAndHydrateUser(req, {} as any);

          expect(validator.validate).toHaveBeenCalledTimes(1);
          expect(cookieService.setCookies).not.toHaveBeenCalled();
          expect(req[idTokenKey]).toBeUndefined();
          expect(console.error).toHaveBeenCalledWith(
            'Token refresh response missing ID token',
            expect.objectContaining({ tokensReceived: ['access_token'] }),
          );
        });

        it('does not set cookies or hydrate when the refreshed id token is invalid', async () => {
          cookies.id_token = 'id';
          cookies.refresh_token = 'refresh';
          validator.validate
            .mockRejectedValueOnce(expired())
            .mockResolvedValueOnce(undefined);
          fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ id_token: 'new-id' }),
          });
          const req = request();

          await middleware.authorizeAndHydrateUser(req, {} as any);

          expect(validator.validate).toHaveBeenLastCalledWith('new-id');
          expect(cookieService.setCookies).not.toHaveBeenCalled();
          expect(hydrater.hydrateUserByEmail).not.toHaveBeenCalled();
          expect(console.error).toHaveBeenCalledWith(
            'New validation failed after refresh',
            expect.objectContaining({ newTokenValid: false }),
          );
        });

        it('logs and stays anonymous when the refresh request throws', async () => {
          cookies.id_token = 'id';
          cookies.refresh_token = 'refresh';
          validator.validate.mockRejectedValue(expired());
          fetchMock.mockRejectedValue(new Error('network down'));
          const req = request();

          await expect(
            middleware.authorizeAndHydrateUser(req, {} as any),
          ).resolves.toBeUndefined();

          expect(req[idTokenKey]).toBeUndefined();
          expect(console.error).toHaveBeenCalledWith(
            'Error during token refresh process',
            expect.objectContaining({ refreshError: 'network down' }),
          );
        });
      });
    });
  },
);

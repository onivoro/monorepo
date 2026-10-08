import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { AccessTokenHeader } from './access-token-header.decorator';
import { AccessTokenUsername } from './access-token-username.decorator';
import { AccessToken } from './access-token.decorator';
import { IdTokenEmail } from './id-token-email.decorator';
import { IdToken } from './id-token.decorator';
import { RequestUser } from './request-user.decorator';
import { accessTokenKey } from '../constants/access-token-key.constant';
import { idTokenKey } from '../constants/id-token-key.constant';
import { requestUserKey } from '../constants/request-user-key.constant';

function resolve(decorator: () => ParameterDecorator, request: any) {
  class Target {
    handler(_value: unknown) {
      return;
    }
  }
  decorator()(Target.prototype, 'handler', 0);
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Target, 'handler');
  const { factory } = args[Object.keys(args)[0]];
  return factory(undefined, {
    switchToHttp: () => ({ getRequest: () => request }),
  });
}

describe('parameter decorators', () => {
  describe('AccessTokenHeader', () => {
    it('strips the Bearer prefix from the authorization header', () => {
      expect(
        resolve(AccessTokenHeader, {
          headers: { authorization: 'Bearer abc.def' },
        }),
      ).toBe('abc.def');
    });

    it('returns an empty string when there is no authorization header', () => {
      expect(resolve(AccessTokenHeader, { headers: {} })).toBe('');
    });
  });

  describe('AccessTokenUsername', () => {
    it('returns username when present', () => {
      expect(
        resolve(AccessTokenUsername, {
          [accessTokenKey]: { username: 'alice', 'cognito:username': 'other' },
        }),
      ).toBe('alice');
    });

    it('falls back to cognito:username', () => {
      expect(
        resolve(AccessTokenUsername, {
          [accessTokenKey]: { 'cognito:username': 'bob' },
        }),
      ).toBe('bob');
    });
  });

  it('AccessToken returns the access token from the request', () => {
    const token = { username: 'alice' };
    expect(resolve(AccessToken, { [accessTokenKey]: token })).toBe(token);
  });

  it('IdToken returns the id token from the request', () => {
    const token = { email: 'a@example.com' };
    expect(resolve(IdToken, { [idTokenKey]: token })).toBe(token);
  });

  describe('IdTokenEmail', () => {
    it('returns the email claim', () => {
      expect(
        resolve(IdTokenEmail, { [idTokenKey]: { email: 'a@example.com' } }),
      ).toBe('a@example.com');
    });

    it('returns undefined when there is no id token', () => {
      expect(resolve(IdTokenEmail, {})).toBeUndefined();
    });
  });

  it('RequestUser returns the hydrated user from the request', () => {
    const user = { id: 1 };
    expect(resolve(RequestUser, { [requestUserKey]: user })).toBe(user);
  });
});

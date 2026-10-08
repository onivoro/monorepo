import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { HasAccessTokenGuard } from './has-access-token.guard';
import { AbstractAccessTokenGuard } from '../classes/abstract-access-token-guard.class';
import { accessTokenKey } from '../constants/access-token-key.constant';

function contextFor(request: any): any {
  return { switchToHttp: () => ({ getRequest: () => request }) };
}

describe(HasAccessTokenGuard.name, () => {
  it('allows a request carrying an access token', () => {
    expect(
      new HasAccessTokenGuard().canActivate(
        contextFor({ [accessTokenKey]: { username: 'u' } }),
      ),
    ).toBe(true);
  });

  it('rejects a request without an access token', () => {
    expect(() => new HasAccessTokenGuard().canActivate(contextFor({}))).toThrow(
      UnauthorizedException,
    );
  });
});

describe(AbstractAccessTokenGuard.name, () => {
  class AdminGuard extends AbstractAccessTokenGuard {
    evaluateToken = jest.fn(
      (token: any) => !!token?.['cognito:groups']?.includes('admin'),
    );
  }

  it('delegates to evaluateToken with the token and request', () => {
    const guard = new AdminGuard();
    const token = { 'cognito:groups': ['admin'] };
    const request = { [accessTokenKey]: token };

    expect(guard.canActivate(contextFor(request))).toBe(true);
    expect(guard.evaluateToken).toHaveBeenCalledWith(token, request);
  });

  it('throws ForbiddenException when evaluateToken returns false', () => {
    expect(() =>
      new AdminGuard().canActivate(
        contextFor({ [accessTokenKey]: { 'cognito:groups': ['user'] } }),
      ),
    ).toThrow(ForbiddenException);
  });
});

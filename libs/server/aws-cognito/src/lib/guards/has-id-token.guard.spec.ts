import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { HasIdTokenGuard } from './has-id-token.guard';
import { HasTokenGuard } from './has-token.guard';
import { AbstractIdTokenGuard } from '../classes/abstract-id-token-guard.class';
import { idTokenKey } from '../constants/id-token-key.constant';

function contextFor(request: any): any {
  return { switchToHttp: () => ({ getRequest: () => request }) };
}

describe(HasIdTokenGuard.name, () => {
  it('allows a request carrying an id token', () => {
    expect(
      new HasIdTokenGuard().canActivate(
        contextFor({ [idTokenKey]: { email: 'u@example.com' } }),
      ),
    ).toBe(true);
  });

  it('rejects a request without an id token', () => {
    expect(() => new HasIdTokenGuard().canActivate(contextFor({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('is exported as HasTokenGuard', () => {
    expect(HasTokenGuard).toBe(HasIdTokenGuard);
  });
});

describe(AbstractIdTokenGuard.name, () => {
  class DomainGuard extends AbstractIdTokenGuard {
    evaluateToken = jest.fn(
      (token: any) => !!token?.email?.endsWith('@example.com'),
    );
  }

  it('delegates to evaluateToken with the token and request', () => {
    const guard = new DomainGuard();
    const token = { email: 'u@example.com' };
    const request = { [idTokenKey]: token };

    expect(guard.canActivate(contextFor(request))).toBe(true);
    expect(guard.evaluateToken).toHaveBeenCalledWith(token, request);
  });

  it('throws ForbiddenException when evaluateToken returns false', () => {
    expect(() =>
      new DomainGuard().canActivate(
        contextFor({ [idTokenKey]: { email: 'u@other.com' } }),
      ),
    ).toThrow(ForbiddenException);
  });
});

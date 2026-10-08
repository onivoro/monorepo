import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { authorizeRequestByAccessToken } from './authorize-request-by-access-token.function';
import { accessTokenKey } from '../constants/access-token-key.constant';

function contextFor(request: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe(authorizeRequestByAccessToken.name, () => {
  it('throws UnauthorizedException when the request has no access token', () => {
    expect(() => authorizeRequestByAccessToken(contextFor({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('returns true when a token is present and no evaluator is given', () => {
    const request = { [accessTokenKey]: { username: 'u' } };

    expect(authorizeRequestByAccessToken(contextFor(request))).toBe(true);
  });

  it('passes the token and request to the evaluator and returns true when it approves', () => {
    const token = { username: 'u' };
    const request = { [accessTokenKey]: token };
    const evaluator = jest.fn().mockReturnValue(true);

    expect(authorizeRequestByAccessToken(contextFor(request), evaluator)).toBe(
      true,
    );
    expect(evaluator).toHaveBeenCalledWith(token, request);
  });

  it('throws ForbiddenException with the given message when the evaluator rejects', () => {
    const request = { [accessTokenKey]: { username: 'u' } };

    expect(() =>
      authorizeRequestByAccessToken(contextFor(request), () => false, 'nope'),
    ).toThrow(new ForbiddenException('nope'));
  });

  it('does not call the evaluator when the token is missing', () => {
    const evaluator = jest.fn();

    expect(() =>
      authorizeRequestByAccessToken(contextFor({}), evaluator),
    ).toThrow(UnauthorizedException);
    expect(evaluator).not.toHaveBeenCalled();
  });
});

import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { authorizeRequestByIdToken } from './authorize-request-by-id-token.function';
import { idTokenKey } from '../constants/id-token-key.constant';

function contextFor(request: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe(authorizeRequestByIdToken.name, () => {
  it('throws UnauthorizedException when the request has no id token', () => {
    expect(() => authorizeRequestByIdToken(contextFor({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('returns true when a token is present and no evaluator is given', () => {
    const request = { [idTokenKey]: { email: 'u@example.com' } };

    expect(authorizeRequestByIdToken(contextFor(request))).toBe(true);
  });

  it('passes the token and request to the evaluator and returns true when it approves', () => {
    const token = { email: 'u@example.com' };
    const request = { [idTokenKey]: token };
    const evaluator = jest.fn().mockReturnValue(true);

    expect(authorizeRequestByIdToken(contextFor(request), evaluator)).toBe(
      true,
    );
    expect(evaluator).toHaveBeenCalledWith(token, request);
  });

  it('throws ForbiddenException with the given message when the evaluator rejects', () => {
    const request = { [idTokenKey]: { email: 'u@example.com' } };

    expect(() =>
      authorizeRequestByIdToken(contextFor(request), () => false, 'nope'),
    ).toThrow(new ForbiddenException('nope'));
  });

  it('does not call the evaluator when the token is missing', () => {
    const evaluator = jest.fn();

    expect(() => authorizeRequestByIdToken(contextFor({}), evaluator)).toThrow(
      UnauthorizedException,
    );
    expect(evaluator).not.toHaveBeenCalled();
  });
});

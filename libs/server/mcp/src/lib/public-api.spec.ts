import * as sdk from '@modelcontextprotocol/server';
import * as api from '../index';

describe('public API', () => {
  it('re-exports the SDK values consumers need, as the same objects', () => {
    expect(api.McpServer).toBe(sdk.McpServer);
    expect(api.OAuthError).toBe(sdk.OAuthError);
    expect(api.OAuthErrorCode).toBe(sdk.OAuthErrorCode);
    expect(api.inputRequired).toBe(sdk.inputRequired);
  });

  it('lets a verifier throw the re-exported OAuthError as a v2 OAuthError', () => {
    const error = new api.OAuthError(api.OAuthErrorCode.InvalidToken, 'bad');
    expect(error).toBeInstanceOf(sdk.OAuthError);
  });
});

import { CognitoRefreshTokenService } from './cognito-refresh-token.service';

describe(CognitoRefreshTokenService.name, () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('calls InitiateAuth on the Cognito JSON API with the required headers', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ AuthenticationResult: { IdToken: 'id' } }),
    });
    global.fetch = fetchMock as any;
    const service = new CognitoRefreshTokenService({
      AWS_REGION: 'us-east-1',
      COGNITO_USER_POOL_ID: 'pool',
      COGNITO_USER_POOL_CLIENT_ID: 'client-id',
    });

    await expect(service.getRefreshToken('refresh')).resolves.toEqual({
      IdToken: 'id',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://cognito-idp.us-east-1.amazonaws.com');
    expect(init.headers).toEqual({
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    });
    expect(JSON.parse(init.body)).toEqual({
      ClientId: 'client-id',
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: { REFRESH_TOKEN: 'refresh' },
    });
  });

  it('returns undefined and logs when Cognito responds with an error', async () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as any;
    const service = new CognitoRefreshTokenService({
      AWS_REGION: 'us-east-1',
      COGNITO_USER_POOL_ID: 'pool',
      COGNITO_USER_POOL_CLIENT_ID: 'client-id',
    });

    await expect(service.getRefreshToken('refresh')).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('Failed to fetch refresh token');
  });
});

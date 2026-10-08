import { DefaultController } from './default.controller';
import { OidcCookieController } from './oidc-cookie.controller';
import { OidcConfigController } from './oidc-config.controller';

const config = {
  AWS_REGION: 'us-east-1',
  COGNITO_USER_POOL_ID: 'us-east-1_pool',
  COGNITO_USER_POOL_CLIENT_ID: 'client-id',
  COGNITO_DOMAIN_PREFIX: 'prefix',
};

function mockResponse(origin?: string): any {
  const res: any = {
    getHeader: jest.fn().mockReturnValue(undefined),
    req: { headers: origin ? { origin } : {} },
  };
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

describe.each([DefaultController, OidcCookieController])('%p', (Controller) => {
  it('sets the token cookies and responds 200', () => {
    const cookieService: any = { setCookies: jest.fn() };
    const res = mockResponse();
    const tokens = { id_token: 'id', refresh_token: 'refresh' };

    new Controller(config, cookieService).post('origin', tokens as any, res);

    expect(cookieService.setCookies).toHaveBeenCalledWith(res, tokens);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      message: 'Cookies set successfully',
    });
  });
});

describe(OidcConfigController.name, () => {
  const controller = new OidcConfigController(config);

  it('getClient sends a client config redirecting to the caller origin', () => {
    const res = mockResponse('https://app.example.com/');

    controller.getClient('ignored', res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.send.mock.calls[0][0];
    expect(body.redirect_uri).toBe('https://app.example.com/post-login');
    expect(body.client_id).toBe('client-id');
    expect(body.authority).toBe(
      'https://prefix.auth.us-east-1.amazoncognito.com',
    );
  });

  it('getEntra returns the idpresponse url', () => {
    expect(controller.getEntra()).toEqual({
      value:
        'https://prefix.auth.us-east-1.amazoncognito.com/oauth2/idpresponse',
    });
  });
});

import { GetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { CognitoUserService } from './cognito-user.service';

const config = {
  AWS_REGION: 'us-east-1',
  COGNITO_USER_POOL_ID: 'us-east-1_pool',
  COGNITO_USER_POOL_CLIENT_ID: 'client-id',
};

describe(CognitoUserService.name, () => {
  let send: jest.Mock;
  let service: CognitoUserService;

  beforeEach(() => {
    send = jest.fn();
    service = new CognitoUserService(config, { send } as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns undefined without calling Cognito when no token is given', async () => {
    await expect(service.getUser()).resolves.toBeUndefined();
    await expect(service.getUser('')).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('sends GetUserCommand with the Bearer prefix stripped', async () => {
    const user = { Username: 'alice', UserAttributes: [] };
    send.mockResolvedValue(user);

    await expect(service.getUser('Bearer access')).resolves.toBe(user);

    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(GetUserCommand);
    expect(command.input).toEqual({ AccessToken: 'access' });
  });

  it('returns undefined and logs when Cognito rejects', async () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    send.mockRejectedValue(new Error('NotAuthorizedException'));

    await expect(service.getUser('access')).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});

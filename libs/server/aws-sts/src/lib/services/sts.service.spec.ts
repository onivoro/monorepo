import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { StsService } from './sts.service';
import { ServerAwsStsConfig } from '../classes/server-aws-sts-config.class';

describe(StsService.name, () => {
  let service: StsService;
  let mockSend: jest.Mock;
  let mockStsClient: STSClient;
  const config: ServerAwsStsConfig = { AWS_REGION: 'us-east-1' };

  beforeEach(() => {
    mockSend = jest.fn();
    mockStsClient = { send: mockSend } as unknown as STSClient;
    service = new StsService(mockStsClient, config);
  });

  it('exposes the STS client', () => {
    expect(service.stsClient).toBe(mockStsClient);
  });

  describe('getAccountId', () => {
    it('returns the account from GetCallerIdentity', async () => {
      mockSend.mockResolvedValue({
        Account: '123456789012',
        Arn: 'arn:aws:iam::123456789012:user/me',
        UserId: 'AIDA',
      });

      await expect(service.getAccountId()).resolves.toBe('123456789012');
      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(GetCallerIdentityCommand);
      expect(command.input).toEqual({});
    });

    it('returns undefined when the response has no account', async () => {
      mockSend.mockResolvedValue({});

      await expect(service.getAccountId()).resolves.toBeUndefined();
    });

    it('propagates client errors', async () => {
      mockSend.mockRejectedValue(new Error('ExpiredToken'));

      await expect(service.getAccountId()).rejects.toThrow('ExpiredToken');
    });
  });
});

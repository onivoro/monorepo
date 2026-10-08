import {
  AttachGroupPolicyCommand,
  CreatePolicyCommand,
  GetGroupCommand,
  IAMClient,
} from '@aws-sdk/client-iam';
import { IamService } from './iam.service';
import { ServerAwsIamConfig } from '../classes/server-aws-iam-config.class';

describe(IamService.name, () => {
  let service: IamService;
  let mockSend: jest.Mock;
  let mockIamClient: IAMClient;
  const config: ServerAwsIamConfig = { AWS_REGION: 'us-east-1' };

  beforeEach(() => {
    mockSend = jest.fn();
    mockIamClient = { send: mockSend } as unknown as IAMClient;
    service = new IamService(mockIamClient, config);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes the IAM client', () => {
    expect(service.iamClient).toBe(mockIamClient);
  });

  describe('getGroup', () => {
    it('sends a GetGroupCommand for the group and returns the response', async () => {
      const response = { Group: { GroupName: 'admins' }, Users: [] };
      mockSend.mockResolvedValue(response);

      await expect(service.getGroup('admins')).resolves.toBe(response);
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(GetGroupCommand);
      expect(command.input).toEqual({ GroupName: 'admins' });
    });

    it('propagates client errors', async () => {
      mockSend.mockRejectedValue(new Error('NoSuchEntity'));

      await expect(service.getGroup('missing')).rejects.toThrow('NoSuchEntity');
    });
  });

  describe('createPolicy', () => {
    const command = new CreatePolicyCommand({
      PolicyName: 'read-only',
      PolicyDocument: '{"Version":"2012-10-17","Statement":[]}',
    });

    it('sends the given command and returns the created policy', async () => {
      const response = { Policy: { Arn: 'arn:aws:iam::1:policy/read-only' } };
      mockSend.mockResolvedValue(response);

      await expect(service.createPolicy(command)).resolves.toBe(response);
      expect(mockSend).toHaveBeenCalledWith(command);
      expect(console.error).not.toHaveBeenCalled();
    });

    it.each([
      ['a response without Policy', {}],
      ['an undefined response', undefined],
    ])('returns undefined and logs for %s', async (_label, response) => {
      mockSend.mockResolvedValue(response);

      await expect(service.createPolicy(command)).resolves.toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        'Failed to create IAM policy "read-only"',
      );
    });

    it('propagates client errors', async () => {
      mockSend.mockRejectedValue(new Error('MalformedPolicyDocument'));

      await expect(service.createPolicy(command)).rejects.toThrow(
        'MalformedPolicyDocument',
      );
    });
  });

  describe('attachPolicyToGroup', () => {
    const params = {
      PolicyArn: 'arn:aws:iam::1:policy/read-only',
      GroupName: 'admins',
    };

    it('sends an AttachGroupPolicyCommand and returns the response', async () => {
      const response = { $metadata: { httpStatusCode: 200 } };
      mockSend.mockResolvedValue(response);

      await expect(service.attachPolicyToGroup(params)).resolves.toBe(response);
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(AttachGroupPolicyCommand);
      expect(command.input).toEqual(params);
    });

    it('logs and resolves undefined when the client fails', async () => {
      const error = new Error('LimitExceeded');
      mockSend.mockRejectedValue(error);

      await expect(
        service.attachPolicyToGroup(params),
      ).resolves.toBeUndefined();
      expect(console.error).toHaveBeenCalledWith({
        detail:
          'Failed to attach policy "arn:aws:iam::1:policy/read-only" to group "admins"',
        error,
      });
    });
  });
});

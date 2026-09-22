import { McpToolContext } from '@onivoro/server-mcp';
import { McpAuditInterceptor } from './mcp-audit-interceptor.service';

describe(McpAuditInterceptor.name, () => {
  const context: McpToolContext = {
    toolName: 'get-invoice-by-id',
    params: { id: 1 },
    metadata: {
      name: 'get-invoice-by-id',
      description: 'Get invoice',
    },
    authInfo: { token: 'token', clientId: 'client', scopes: [] },
  };

  it('writes a resolved audit event after the tool succeeds', async () => {
    const sink = { writeAuditEvent: jest.fn() };
    const interceptor = new McpAuditInterceptor(
      { resolveEmail: jest.fn().mockReturnValue('user@example.com') },
      {
        resolveAuditEvent: jest.fn().mockReturnValue({
          accessType: 'read',
          resourceType: 'invoice',
          resourceIds: [1, undefined, '2'],
        }),
      },
      sink,
    );

    await expect(
      interceptor.intercept(
        context,
        jest.fn().mockResolvedValue({
          id: 1,
        }),
      ),
    ).resolves.toEqual({ id: 1 });

    expect(sink.writeAuditEvent).toHaveBeenCalledWith({
      accessEmail: 'user@example.com',
      accessType: 'read',
      resourceType: 'invoice',
      resourceIds: [1, '2'],
      toolName: 'get-invoice-by-id',
      context,
    });
  });

  it('does not write when email cannot be resolved', async () => {
    const sink = { writeAuditEvent: jest.fn() };
    const interceptor = new McpAuditInterceptor(
      { resolveEmail: jest.fn().mockReturnValue(undefined) },
      {
        resolveAuditEvent: jest.fn().mockReturnValue({
          accessType: 'read',
          resourceType: 'invoice',
          resourceIds: [1],
        }),
      },
      sink,
    );

    await interceptor.intercept(
      context,
      jest.fn().mockResolvedValue({ id: 1 }),
    );

    expect(sink.writeAuditEvent).not.toHaveBeenCalled();
  });

  it('does not fail the tool when audit writing fails', async () => {
    const interceptor = new McpAuditInterceptor(
      { resolveEmail: jest.fn().mockReturnValue('user@example.com') },
      {
        resolveAuditEvent: jest.fn().mockReturnValue({
          accessType: 'read',
          resourceType: 'invoice',
          resourceIds: [1],
        }),
      },
      { writeAuditEvent: jest.fn().mockRejectedValue(new Error('log failed')) },
    );

    await expect(
      interceptor.intercept(context, jest.fn().mockResolvedValue('ok')),
    ).resolves.toBe('ok');
  });

  it('rethrows tool failures without writing an audit event', async () => {
    const sink = { writeAuditEvent: jest.fn() };
    const error = new Error('tool failed');
    const interceptor = new McpAuditInterceptor(
      { resolveEmail: jest.fn().mockReturnValue('user@example.com') },
      {
        resolveAuditEvent: jest.fn().mockReturnValue({
          accessType: 'read',
          resourceType: 'invoice',
          resourceIds: [1],
        }),
      },
      sink,
    );

    await expect(
      interceptor.intercept(context, jest.fn().mockRejectedValue(error)),
    ).rejects.toBe(error);
    expect(sink.writeAuditEvent).not.toHaveBeenCalled();
  });
});

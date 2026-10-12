import { McpAccessDeniedError, McpToolContext } from '@onivoro/server-mcp';
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
      outcome: 'success',
      // The bearer token never reaches the sink.
      context: { ...context, authInfo: { clientId: 'client', scopes: [] } },
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

  function auditing() {
    const sink = { writeAuditEvent: jest.fn() };
    const resolveAuditEvent = jest.fn().mockReturnValue({
      accessType: 'read',
      resourceType: 'invoice',
      resourceIds: [1],
    });
    const interceptor = new McpAuditInterceptor(
      { resolveEmail: jest.fn().mockReturnValue('user@example.com') },
      { resolveAuditEvent },
      sink,
    );
    return { sink, resolveAuditEvent, interceptor };
  }

  it('records a tool that throws as an error, then rethrows', async () => {
    const { sink, resolveAuditEvent, interceptor } = auditing();
    const error = new Error('tool failed');

    await expect(
      interceptor.intercept(context, jest.fn().mockRejectedValue(error)),
    ).rejects.toBe(error);

    expect(resolveAuditEvent).toHaveBeenCalledWith(context, undefined, 'error');
    expect(sink.writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'error', error: 'tool failed' }),
    );
  });

  it('records a returned isError result as an error', async () => {
    const { sink, interceptor } = auditing();
    const result = {
      content: [{ type: 'text', text: 'Invoice is locked' }],
      isError: true,
    };

    await expect(
      interceptor.intercept(context, jest.fn().mockResolvedValue(result)),
    ).resolves.toBe(result);

    expect(sink.writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'error', error: 'Invoice is locked' }),
    );
  });

  it('does not record a round that asks the client for input', async () => {
    const { sink, interceptor } = auditing();
    const result = { resultType: 'input_required', inputRequests: {} };

    await expect(
      interceptor.intercept(context, jest.fn().mockResolvedValue(result)),
    ).resolves.toBe(result);

    expect(sink.writeAuditEvent).not.toHaveBeenCalled();
  });

  it('records a guard denial as denied', async () => {
    const { sink, resolveAuditEvent, interceptor } = auditing();

    await interceptor.onRejected(
      context,
      new McpAccessDeniedError('Access denied', 'McpScopeGuard'),
    );

    expect(resolveAuditEvent).toHaveBeenCalledWith(
      context,
      undefined,
      'denied',
    );
    expect(sink.writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'denied', error: 'Access denied' }),
    );
  });

  it('records other rejections, such as invalid arguments, as rejected', async () => {
    const { sink, interceptor } = auditing();

    await interceptor.onRejected(context, new Error('Expected number'));

    expect(sink.writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'rejected',
        error: 'Expected number',
      }),
    );
  });
});

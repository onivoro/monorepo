import { Logger } from '@nestjs/common';
import { McpToolContext } from '@onivoro/server-mcp';
import { McpAuditInterceptor } from './mcp-audit-interceptor.service';

describe(`${McpAuditInterceptor.name} edge cases`, () => {
  const context: McpToolContext = {
    toolName: 'list-invoices',
    params: {},
    metadata: { name: 'list-invoices', description: 'List invoices' },
  };

  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  function createInterceptor(options: {
    email?: unknown;
    event?: unknown;
    emailImpl?: jest.Mock;
    eventImpl?: jest.Mock;
    sinkImpl?: jest.Mock;
  }) {
    const resolveEmail =
      options.emailImpl ?? jest.fn().mockReturnValue(options.email);
    const resolveAuditEvent =
      options.eventImpl ?? jest.fn().mockReturnValue(options.event);
    const writeAuditEvent = options.sinkImpl ?? jest.fn();
    const interceptor = new McpAuditInterceptor(
      { resolveEmail } as any,
      { resolveAuditEvent } as any,
      { writeAuditEvent },
    );
    return { interceptor, resolveEmail, resolveAuditEvent, writeAuditEvent };
  }

  it('passes the context and tool result to the event resolver', async () => {
    const { interceptor, resolveEmail, resolveAuditEvent } = createInterceptor({
      email: 'user@example.com',
      event: { accessType: 'read', resourceType: 'invoice' },
    });

    await interceptor.intercept(context, async () => ['a', 'b']);

    expect(resolveEmail).toHaveBeenCalledWith(context);
    expect(resolveAuditEvent).toHaveBeenCalledWith(context, ['a', 'b']);
  });

  it('does not write when the event resolver returns undefined', async () => {
    const { interceptor, writeAuditEvent } = createInterceptor({
      email: 'user@example.com',
      event: undefined,
    });

    await expect(
      interceptor.intercept(context, async () => 'result'),
    ).resolves.toBe('result');
    expect(writeAuditEvent).not.toHaveBeenCalled();
  });

  it('does not write when the email resolver returns an empty string', async () => {
    const { interceptor, writeAuditEvent } = createInterceptor({
      email: '',
      event: { accessType: 'read', resourceType: 'invoice' },
    });

    await interceptor.intercept(context, async () => 'result');
    expect(writeAuditEvent).not.toHaveBeenCalled();
  });

  it('supports async resolvers and an async sink', async () => {
    const { interceptor, writeAuditEvent } = createInterceptor({
      emailImpl: jest.fn().mockResolvedValue('async@example.com'),
      eventImpl: jest.fn().mockResolvedValue({
        accessType: 'write',
        resourceType: 'invoice',
        resourceIds: ['x'],
      }),
      sinkImpl: jest.fn().mockResolvedValue(undefined),
    });

    await interceptor.intercept(context, async () => null);

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        accessEmail: 'async@example.com',
        accessType: 'write',
        resourceIds: ['x'],
      }),
    );
  });

  it('defaults missing resourceIds to an empty array', async () => {
    const { interceptor, writeAuditEvent } = createInterceptor({
      email: 'user@example.com',
      event: { accessType: 'read', resourceType: 'invoice' },
    });

    await interceptor.intercept(context, async () => undefined);

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceIds: [],
        toolName: 'list-invoices',
        context,
      }),
    );
  });

  it('keeps zero and empty-string ids but drops null and undefined', async () => {
    const { interceptor, writeAuditEvent } = createInterceptor({
      email: 'user@example.com',
      event: {
        accessType: 'read',
        resourceType: 'invoice',
        resourceIds: [0, null, '', undefined, 5],
      },
    });

    await interceptor.intercept(context, async () => undefined);

    expect(writeAuditEvent.mock.calls[0][0].resourceIds).toEqual([0, '', 5]);
  });

  it('logs the error message and still returns the result when a resolver rejects', async () => {
    const { interceptor, writeAuditEvent } = createInterceptor({
      emailImpl: jest.fn().mockRejectedValue(new Error('lookup failed')),
      event: { accessType: 'read', resourceType: 'invoice' },
    });

    await expect(interceptor.intercept(context, async () => 42)).resolves.toBe(
      42,
    );

    expect(writeAuditEvent).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'MCP audit logging failed for list-invoices: lookup failed',
    );
  });

  it('logs "Unknown error" when a non-Error value is thrown', async () => {
    const { interceptor } = createInterceptor({
      email: 'user@example.com',
      event: { accessType: 'read', resourceType: 'invoice' },
      sinkImpl: jest.fn().mockImplementation(() => {
        throw 'boom';
      }),
    });

    await expect(
      interceptor.intercept(context, async () => 'ok'),
    ).resolves.toBe('ok');

    expect(warnSpy).toHaveBeenCalledWith(
      'MCP audit logging failed for list-invoices: Unknown error',
    );
  });
});

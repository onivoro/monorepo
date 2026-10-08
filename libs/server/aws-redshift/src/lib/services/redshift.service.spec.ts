import {
  DescribeStatementCommand,
  ExecuteStatementCommand,
  GetStatementResultCommand,
  RedshiftDataClient,
} from '@aws-sdk/client-redshift-data';
import {
  GetWorkgroupCommand,
  RedshiftServerlessClient,
} from '@aws-sdk/client-redshift-serverless';
import { RedshiftDataService } from './redshift.service';

describe(RedshiftDataService.name, () => {
  const target = { database: 'analytics', workgroupName: 'analytics-wg' };
  let send: jest.Mock;
  let serverlessSend: jest.Mock;
  let service: RedshiftDataService;

  const sent = (type: Function) =>
    send.mock.calls
      .map(([command]) => command)
      .filter((command) => command instanceof type);

  beforeEach(() => {
    send = jest.fn();
    serverlessSend = jest.fn();
    service = new RedshiftDataService(
      { send } as unknown as RedshiftDataClient,
      { send: serverlessSend } as unknown as RedshiftServerlessClient,
    );
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /** Responds FINISHED to every DescribeStatement and Id `stmt-N` to every ExecuteStatement. */
  const finishEverything = (resultRows?: number) => {
    let n = 0;
    send.mockImplementation(async (command) => {
      if (command instanceof ExecuteStatementCommand)
        return { Id: `stmt-${++n}` };
      if (command instanceof DescribeStatementCommand)
        return { Status: 'FINISHED', ResultRows: resultRows };
      if (command instanceof GetStatementResultCommand) return { Records: [] };
      throw new Error('unexpected command');
    });
  };

  describe('waitForStatement', () => {
    it('returns ResultRows once the statement finishes', async () => {
      send.mockResolvedValue({ Status: 'FINISHED', ResultRows: 3 });

      await expect(service.waitForStatement('stmt')).resolves.toBe(3);
      expect(sent(DescribeStatementCommand)[0].input).toEqual({ Id: 'stmt' });
    });

    it('throws with the statement error when it fails', async () => {
      send.mockResolvedValue({ Status: 'FAILED', Error: 'syntax error' });

      await expect(service.waitForStatement('stmt')).rejects.toThrow(
        'SQL statement failed: syntax error',
      );
    });

    it('polls with the given delay until the statement finishes', async () => {
      jest.useFakeTimers();
      send
        .mockResolvedValueOnce({ Status: 'SUBMITTED' })
        .mockResolvedValueOnce({ Status: 'STARTED' })
        .mockResolvedValueOnce({ Status: 'FINISHED', ResultRows: 1 });

      const result = service.waitForStatement('stmt', 10, 500);
      await jest.advanceTimersByTimeAsync(499);
      expect(send).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(send).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(500);

      await expect(result).resolves.toBe(1);
      expect(send).toHaveBeenCalledTimes(3);
    });

    it('times out after maxAttempts', async () => {
      jest.useFakeTimers();
      send.mockResolvedValue({ Status: 'STARTED' });

      const result = service.waitForStatement('stmt', 3, 100);
      const assertion = expect(result).rejects.toThrow(
        'Timeout waiting for SQL statement to complete',
      );
      await jest.advanceTimersByTimeAsync(300);

      await assertion;
      expect(send).toHaveBeenCalledTimes(3);
    });

    it('throws when the statement is aborted', async () => {
      send.mockResolvedValue({ Status: 'ABORTED' });

      await expect(service.waitForStatement('stmt')).rejects.toThrow(
        'SQL statement was aborted',
      );
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('throws with the statement error when it is aborted with one', async () => {
      send.mockResolvedValue({ Status: 'ABORTED', Error: 'cancelled by user' });

      await expect(service.waitForStatement('stmt')).rejects.toThrow(
        'cancelled by user',
      );
    });
  });

  describe('verifyEndpointAccess', () => {
    it('returns the workgroup response when it has an endpoint address', async () => {
      const response = {
        workgroup: { endpoint: { address: 'wg.redshift.example' } },
      };
      serverlessSend.mockResolvedValue(response);

      await expect(service.verifyEndpointAccess('wg')).resolves.toBe(response);
      const [command] = serverlessSend.mock.calls[0];
      expect(command).toBeInstanceOf(GetWorkgroupCommand);
      expect(command.input).toEqual({ workgroupName: 'wg' });
    });

    it.each([
      [undefined],
      [{}],
      [{ workgroup: {} }],
      [{ workgroup: { endpoint: {} } }],
    ])(
      'logs and returns undefined when the endpoint is missing (%j)',
      async (response) => {
        serverlessSend.mockResolvedValue(response);

        await expect(service.verifyEndpointAccess('wg')).resolves.toBe(
          undefined,
        );
        expect(console.error).toHaveBeenCalledWith(
          'Could not retrieve endpoint for workgroupName "wg"',
        );
      },
    );
  });

  describe('addIamUserToDatabaseGroup', () => {
    it('adds the user to the group and waits for the statement', async () => {
      finishEverything();

      await service.addIamUserToDatabaseGroup({
        ...target,
        user: 'IAM:alice',
        group: 'readers',
      });

      const [execute] = sent(ExecuteStatementCommand);
      expect(execute.input).toEqual({
        Database: 'analytics',
        Sql: 'ALTER GROUP readers ADD USER "IAM:alice";',
        WorkgroupName: 'analytics-wg',
      });
      expect(sent(DescribeStatementCommand)[0].input).toEqual({
        Id: 'stmt-1',
      });
    });

    it('warns instead of throwing when the statement fails', async () => {
      const error = new Error('denied');
      send.mockRejectedValue(error);

      await expect(
        service.addIamUserToDatabaseGroup({
          ...target,
          user: 'alice',
          group: 'readers',
        }),
      ).resolves.toBeUndefined();
      expect(console.warn).toHaveBeenCalledWith({
        detail: 'Warning adding alice to group:',
        error,
      });
    });
  });

  describe('createDatabaseUser (errors)', () => {
    it('warns and rethrows when a statement fails', async () => {
      const error = new Error('denied');
      send.mockRejectedValue(error);

      await expect(
        service.createDatabaseUser({ ...target, user: 'alice' }),
      ).rejects.toBe(error);
      expect(console.warn).toHaveBeenCalledWith({
        detail: 'Warning creating user alice',
        error,
      });
    });
  });

  describe('grantUsageOnSchema', () => {
    const input = { ...target, schema: 'reporting', group: 'readers' };

    it('runs the three grant statements in order', async () => {
      finishEverything();

      await service.grantUsageOnSchema(input);

      expect(sent(ExecuteStatementCommand).map((c) => c.input)).toEqual(
        [
          'GRANT USAGE ON SCHEMA reporting TO GROUP readers;',
          'GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO GROUP readers;',
          'ALTER DEFAULT PRIVILEGES IN SCHEMA reporting GRANT SELECT ON TABLES TO GROUP readers;',
        ].map((Sql) => ({
          Database: 'analytics',
          Sql,
          WorkgroupName: 'analytics-wg',
        })),
      );
      expect(sent(DescribeStatementCommand)).toHaveLength(3);
    });

    it('warns about a failing statement and carries on with the rest', async () => {
      const error = new Error('no such schema');
      send.mockImplementation(async (command) => {
        if (command instanceof ExecuteStatementCommand) {
          if (command.input.Sql?.startsWith('GRANT USAGE')) throw error;
          return { Id: 'stmt' };
        }
        if (command instanceof DescribeStatementCommand)
          return { Status: 'FINISHED' };
        throw new Error('unexpected command');
      });

      await expect(service.grantUsageOnSchema(input)).resolves.toBeUndefined();
      expect(sent(ExecuteStatementCommand)).toHaveLength(3);
      expect(console.warn).toHaveBeenCalledWith({
        Sql: 'GRANT USAGE ON SCHEMA reporting TO GROUP readers;',
        error,
      });
    });
  });

  describe('createDbGroupFromIamGroupIfNotExists', () => {
    const input = { ...target, iamGroup: 'readers' };

    it('creates the group when it does not exist', async () => {
      finishEverything(0);

      await service.createDbGroupFromIamGroupIfNotExists(input);

      const [check, create] = sent(ExecuteStatementCommand);
      expect(check.input.Sql).toBe(
        "SELECT 1 FROM pg_group WHERE groname = 'readers';",
      );
      expect(create.input).toEqual({
        Database: 'analytics',
        Sql: 'CREATE GROUP readers;',
        WorkgroupName: 'analytics-wg',
      });
      expect(console.log).toHaveBeenCalledWith('Created "readers" group');
    });

    it('does nothing when the group exists', async () => {
      finishEverything(1);

      await service.createDbGroupFromIamGroupIfNotExists(input);

      expect(sent(ExecuteStatementCommand)).toHaveLength(1);
      expect(console.log).toHaveBeenCalledWith(
        '"readers" group already exists',
      );
    });

    it('logs and rethrows errors', async () => {
      const error = new Error('denied');
      send.mockRejectedValue(error);

      await expect(
        service.createDbGroupFromIamGroupIfNotExists(input),
      ).rejects.toBe(error);
      expect(console.error).toHaveBeenCalledWith({ error });
    });
  });

  describe('queryV1', () => {
    it('executes the statement and resolves the result row count', async () => {
      finishEverything(5);

      await expect(service.queryV1(target, 'DELETE FROM t')).resolves.toBe(5);
      const [execute] = sent(ExecuteStatementCommand);
      expect(execute.input).toEqual({
        Database: 'analytics',
        Sql: 'DELETE FROM t',
        WorkgroupName: 'analytics-wg',
        Parameters: undefined,
      });
    });

    it('converts a parameter record into string SqlParameters', async () => {
      finishEverything(0);

      await service.queryV1(target, 'SELECT :a, :b, :c, :d, :e', {
        a: 'x',
        b: 42,
        c: false,
        d: null,
        e: undefined,
      });

      expect(sent(ExecuteStatementCommand)[0].input.Parameters).toEqual([
        { name: 'a', value: 'x' },
        { name: 'b', value: '42' },
        { name: 'c', value: 'false' },
        { name: 'd', value: undefined },
        { name: 'e', value: undefined },
      ]);
    });

    it('passes SqlParameter arrays through unchanged', async () => {
      finishEverything(0);
      const parameters = [{ name: 'id', value: '1' }];

      await service.queryV1(target, 'SELECT :id', parameters);

      expect(sent(ExecuteStatementCommand)[0].input.Parameters).toBe(
        parameters,
      );
    });
  });

  describe('query (more)', () => {
    it('converts record parameters', async () => {
      finishEverything();

      await expect(
        service.query(target, 'SELECT :id', { id: 7 }),
      ).resolves.toEqual([]);
      expect(sent(ExecuteStatementCommand)[0].input.Parameters).toEqual([
        { name: 'id', value: '7' },
      ]);
    });

    it('throws when no statement id is returned', async () => {
      send.mockResolvedValue({});

      await expect(service.query(target, 'SELECT 1')).rejects.toThrow(
        'Failed to get statement ID',
      );
      expect(console.error).toHaveBeenCalled();
    });

    it('throws the statement error when it fails', async () => {
      send.mockImplementation(async (command) => {
        if (command instanceof ExecuteStatementCommand) return { Id: 'stmt' };
        return { Status: 'FAILED', Error: 'relation does not exist' };
      });

      await expect(service.query(target, 'SELECT 1')).rejects.toThrow(
        'relation does not exist',
      );
    });

    it('uses the statement error message when aborted with one', async () => {
      send.mockImplementation(async (command) => {
        if (command instanceof ExecuteStatementCommand) return { Id: 'stmt' };
        return { Status: 'ABORTED', Error: 'cancelled by user' };
      });

      await expect(service.query(target, 'SELECT 1')).rejects.toThrow(
        'cancelled by user',
      );
    });

    it('polls every second until the statement finishes', async () => {
      jest.useFakeTimers();
      const statuses = ['SUBMITTED', 'PICKED', undefined, 'FINISHED'];
      send.mockImplementation(async (command) => {
        if (command instanceof ExecuteStatementCommand) return { Id: 'stmt' };
        if (command instanceof DescribeStatementCommand)
          return { Status: statuses.shift() };
        if (command instanceof GetStatementResultCommand)
          return { Records: [[{ stringValue: 'ok' }]] };
        throw new Error('unexpected command');
      });

      const result = service.query(target, 'SELECT 1');
      await jest.advanceTimersByTimeAsync(999);
      expect(sent(DescribeStatementCommand)).toHaveLength(1);
      await jest.advanceTimersByTimeAsync(3000);

      await expect(result).resolves.toEqual([['ok']]);
      expect(sent(DescribeStatementCommand)).toHaveLength(4);
    });

    it('returns [] when fetching results fails', async () => {
      send.mockImplementation(async (command) => {
        if (command instanceof ExecuteStatementCommand) return { Id: 'stmt' };
        if (command instanceof DescribeStatementCommand)
          return { Status: 'FINISHED' };
        throw new Error('no result set');
      });

      await expect(
        service.query(target, 'UPDATE t SET a = 1'),
      ).resolves.toEqual([]);
    });

    it('treats a page without Records as empty', async () => {
      send.mockImplementation(async (command) => {
        if (command instanceof ExecuteStatementCommand) return { Id: 'stmt' };
        if (command instanceof DescribeStatementCommand)
          return { Status: 'FINISHED' };
        return {};
      });

      await expect(service.query(target, 'SELECT 1')).resolves.toEqual([]);
    });
  });

  describe('getAssociatedIAmRolesByWorkgroup (results and errors)', () => {
    it('returns the mapped query rows', async () => {
      send.mockImplementation(async (command) => {
        if (command instanceof ExecuteStatementCommand) return { Id: 'stmt' };
        if (command instanceof DescribeStatementCommand)
          return { Status: 'FINISHED' };
        return {
          Records: [
            [
              { stringValue: 'readers' },
              { stringValue: 'alice' },
              { longValue: 100 },
              { longValue: 1 },
              { booleanValue: true },
            ],
          ],
        };
      });

      await expect(
        service.getAssociatedIAmRolesByWorkgroup(target),
      ).resolves.toEqual([['readers', 'alice', 100, 1, true]]);
      expect(sent(ExecuteStatementCommand)[0].input.Sql).toContain(
        'FROM pg_group g',
      );
    });

    it('logs and rethrows Errors', async () => {
      send.mockRejectedValue(new Error('denied'));

      await expect(
        service.getAssociatedIAmRolesByWorkgroup(target),
      ).rejects.toThrow('denied');
      expect(console.error).toHaveBeenCalledWith(
        'Error getting workgroup roles: denied',
      );
    });

    it('wraps non-Error rejections', async () => {
      send.mockRejectedValue('denied');

      await expect(
        service.getAssociatedIAmRolesByWorkgroup(target),
      ).rejects.toThrow('An unknown error occurred');
    });
  });

  describe('query', () => {
    it('throws when the statement is aborted instead of polling forever', async () => {
      send.mockImplementation(async (command) => {
        if (command instanceof ExecuteStatementCommand) return { Id: 'stmt' };
        if (command instanceof DescribeStatementCommand)
          return { Status: 'ABORTED' };
        throw new Error('unexpected command');
      });

      await expect(service.query(target, 'SELECT 1')).rejects.toThrow(
        'SQL statement was aborted',
      );
      expect(sent(DescribeStatementCommand)).toHaveLength(1);
    });

    it('follows NextToken and keeps falsy and boolean values', async () => {
      send.mockImplementation(async (command) => {
        if (command instanceof ExecuteStatementCommand) return { Id: 'stmt' };
        if (command instanceof DescribeStatementCommand)
          return { Status: 'FINISHED' };
        if (command instanceof GetStatementResultCommand) {
          return command.input.NextToken
            ? {
                Records: [
                  [
                    { stringValue: 'b' },
                    { longValue: 2 },
                    { doubleValue: 1.5 },
                    { booleanValue: true },
                    { isNull: true },
                  ],
                ],
              }
            : {
                Records: [
                  [
                    { stringValue: '' },
                    { longValue: 0 },
                    { doubleValue: 0 },
                    { booleanValue: false },
                    { isNull: true },
                  ],
                ],
                NextToken: 'page-2',
              };
        }
        throw new Error('unexpected command');
      });

      await expect(service.query(target, 'SELECT 1')).resolves.toEqual([
        ['', 0, 0, false, undefined],
        ['b', 2, 1.5, true, undefined],
      ]);
      expect(
        sent(GetStatementResultCommand).map(
          (command) => command.input.NextToken,
        ),
      ).toEqual([undefined, 'page-2']);
    });
  });

  describe('createDatabaseUser', () => {
    const respond = (existingRows: number) =>
      send.mockImplementation(async (command) => {
        if (command instanceof ExecuteStatementCommand)
          return {
            Id: command.input.Sql?.startsWith('CREATE') ? 'create' : 'check',
          };
        if (command instanceof DescribeStatementCommand)
          return {
            Status: 'FINISHED',
            ResultRows: command.input.Id === 'check' ? existingRows : -1,
          };
        throw new Error('unexpected command');
      });

    it('looks up only the requested user and creates it when absent', async () => {
      respond(0);

      const password = await service.createDatabaseUser({
        ...target,
        user: 'alice',
      });

      const [check, create] = sent(ExecuteStatementCommand);
      expect(check.input.Sql).toContain('WHERE u.usename = :user');
      expect(check.input.Parameters).toEqual([
        { name: 'user', value: 'alice' },
      ]);
      expect(create.input.Sql).toBe(
        `CREATE USER alice PASSWORD '${password}';`,
      );
      expect(password).toMatch(/^IAM_[0-9a-f_]+$/);
    });

    it("returns '' without creating when the user exists", async () => {
      respond(1);

      await expect(
        service.createDatabaseUser({ ...target, user: 'alice' }),
      ).resolves.toBe('');
      expect(sent(ExecuteStatementCommand)).toHaveLength(1);
    });
  });

  describe('getAssociatedIAmRolesByWorkgroup', () => {
    it('sends no unbound positional placeholders', async () => {
      send.mockImplementation(async (command) => {
        if (command instanceof ExecuteStatementCommand) return { Id: 'stmt' };
        if (command instanceof DescribeStatementCommand)
          return { Status: 'FINISHED' };
        if (command instanceof GetStatementResultCommand)
          return { Records: [] };
        throw new Error('unexpected command');
      });

      await service.getAssociatedIAmRolesByWorkgroup(target);

      const [execute] = sent(ExecuteStatementCommand);
      expect(execute.input.Sql).not.toMatch(/\$\d/);
      expect(execute.input.Parameters).toBeUndefined();
    });
  });
});

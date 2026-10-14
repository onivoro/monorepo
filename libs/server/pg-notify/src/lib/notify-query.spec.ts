import {
  PG_NOTIFY_MAX_PAYLOAD_BYTES,
  buildNotifyQuery,
  notifyInTransaction,
} from './notify-query';

const oversized = 'x'.repeat(PG_NOTIFY_MAX_PAYLOAD_BYTES + 1);

function fakeClient() {
  const calls: { text: string; values?: unknown[] }[] = [];
  const client = {
    query: jest.fn(async (text: string, values?: unknown[]) => {
      calls.push({ text, values });
      return { rows: [] };
    }),
  };
  return { client, calls };
}

describe('buildNotifyQuery', () => {
  it('builds a parameterised pg_notify, never interpolating', () => {
    expect(buildNotifyQuery("o'brien; DROP TABLE x", '{"a":1}')).toEqual({
      text: 'SELECT pg_notify($1, $2)',
      values: ["o'brien; DROP TABLE x", '{"a":1}'],
      channel: "o'brien; DROP TABLE x",
      payload: '{"a":1}',
    });
  });

  // postgres requires a payload shorter than 8000 bytes: 7999 is the largest
  it('accepts a 7999 byte payload', () => {
    const payload = 'x'.repeat(7999);
    expect(buildNotifyQuery('events', payload)?.payload).toBe(payload);
    expect(PG_NOTIFY_MAX_PAYLOAD_BYTES).toBe(7999);
  });

  it('rejects an 8000 byte payload, which postgres would fail', () => {
    expect(buildNotifyQuery('events', 'x'.repeat(8000))).toBeUndefined();
  });

  it('sends an 8000 byte payload to onOversized', () => {
    const onOversized = jest.fn(() => '{"reload":true}');

    expect(
      buildNotifyQuery('events', 'x'.repeat(8000), { onOversized })?.payload,
    ).toBe('{"reload":true}');
    expect(onOversized).toHaveBeenCalled();
  });

  it('returns undefined for an oversized payload with no handler', () => {
    expect(buildNotifyQuery('events', oversized)).toBeUndefined();
  });

  it('measures the limit in bytes, not characters', () => {
    // every character is 4 bytes: 2000 of them are 8000 bytes, 1999 are 7996
    expect(buildNotifyQuery('events', '𝍧'.repeat(2000))).toBeUndefined();
    expect(buildNotifyQuery('events', '𝍧'.repeat(1999))).toBeDefined();
  });

  it('sends what onOversized returns, and passes it the payload and channel', () => {
    const onOversized = jest.fn(() => '{"id":"row-1","reload":true}');

    const query = buildNotifyQuery('events', oversized, { onOversized });

    expect(onOversized).toHaveBeenCalledWith(oversized, 'events');
    expect(query?.values).toEqual(['events', '{"id":"row-1","reload":true}']);
    expect(query?.payload).toBe('{"id":"row-1","reload":true}');
  });

  it('does not consult onOversized for a payload that fits', () => {
    const onOversized = jest.fn(() => 'replacement');

    buildNotifyQuery('events', 'small', { onOversized });

    expect(onOversized).not.toHaveBeenCalled();
  });

  it('returns undefined when onOversized returns undefined', () => {
    expect(
      buildNotifyQuery('events', oversized, { onOversized: () => undefined }),
    ).toBeUndefined();
  });

  it('returns undefined when the replacement is itself oversized', () => {
    expect(
      buildNotifyQuery('events', oversized, {
        onOversized: () => 'x'.repeat(8000),
      }),
    ).toBeUndefined();
  });

  // pg_notify would fail the statement, aborting the caller's transaction
  it('throws for a channel postgres would reject', () => {
    expect(() => buildNotifyQuery('', 'x')).toThrow('cannot be empty');
    expect(() => buildNotifyQuery('a'.repeat(64), 'x')).toThrow(
      'is 64 bytes; Postgres allows at most 63',
    );
    // bytes, not characters: 16 four-byte characters are 64 bytes
    expect(() => buildNotifyQuery('𝍧'.repeat(16), 'x')).toThrow('64 bytes');
    expect(() => buildNotifyQuery('a\0b', 'x')).toThrow('NUL');
  });

  it('accepts a 63 byte channel', () => {
    expect(buildNotifyQuery('a'.repeat(63), 'x')?.channel).toBe('a'.repeat(63));
  });
});

describe('notifyInTransaction', () => {
  it("runs the notify on the caller's client and reports it sent", async () => {
    const { client, calls } = fakeClient();

    await expect(
      notifyInTransaction(client, 'events', '{"id":"1"}'),
    ).resolves.toBe(true);

    expect(calls).toEqual([
      { text: 'SELECT pg_notify($1, $2)', values: ['events', '{"id":"1"}'] },
    ]);
  });

  it('throws before querying for an invalid channel', async () => {
    const { client } = fakeClient();

    await expect(notifyInTransaction(client, '', 'x')).rejects.toThrow('empty');
    expect(client.query).not.toHaveBeenCalled();
  });

  it('sends nothing and reports false when the payload is dropped', async () => {
    const { client } = fakeClient();

    await expect(
      notifyInTransaction(client, 'events', oversized),
    ).resolves.toBe(false);

    expect(client.query).not.toHaveBeenCalled();
  });

  it('applies onOversized', async () => {
    const { client, calls } = fakeClient();

    await notifyInTransaction(client, 'events', oversized, {
      onOversized: () => '{"reload":true}',
    });

    expect(calls[0].values).toEqual(['events', '{"reload":true}']);
  });

  // the caller's transaction must see the failure, so it can roll back
  it('propagates a failing query', async () => {
    const client = { query: jest.fn().mockRejectedValue(new Error('aborted')) };

    await expect(notifyInTransaction(client, 'events', 'x')).rejects.toThrow(
      'aborted',
    );
  });
});

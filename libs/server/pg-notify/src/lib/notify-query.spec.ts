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

  it('accepts a payload exactly at the limit', () => {
    const payload = 'x'.repeat(PG_NOTIFY_MAX_PAYLOAD_BYTES);
    expect(buildNotifyQuery('events', payload)?.payload).toBe(payload);
  });

  it('returns undefined for an oversized payload with no handler', () => {
    expect(buildNotifyQuery('events', oversized)).toBeUndefined();
  });

  it('measures the limit in bytes, not characters', () => {
    // every character is 4 bytes, so half the character budget is over
    expect(
      buildNotifyQuery('events', '𝍧'.repeat(PG_NOTIFY_MAX_PAYLOAD_BYTES / 2)),
    ).toBeUndefined();
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
      buildNotifyQuery('events', oversized, { onOversized: () => oversized }),
    ).toBeUndefined();
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

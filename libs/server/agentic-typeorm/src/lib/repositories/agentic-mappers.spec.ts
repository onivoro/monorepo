import {
  fromConversationRecord,
  fromMessageRecord,
  fromPromptRecord,
  fromRunRecord,
  fromSummaryRecord,
  toConversationRecord,
  toDate,
  toIso,
  toMessageRecord,
  toPromptRecord,
  toRunRecord,
  toSummaryRecord,
} from './agentic-mappers';

const iso = '2026-01-02T03:04:05.000Z';
const date = new Date(iso);

describe('toDate / toIso', () => {
  it('passes Date instances through and parses strings', () => {
    expect(toDate(date)).toBe(date);
    expect(toDate(iso)).toEqual(date);
  });

  it('normalises strings and dates to ISO strings', () => {
    expect(toIso(date)).toBe(iso);
    expect(toIso('2026-01-02T04:04:05+01:00')).toBe(iso);
  });
});

describe('conversation mapping', () => {
  const conversation = {
    id: 'c1',
    title: 'Title',
    status: 'active' as const,
    participantIds: ['u1'],
    latestSummaryMessageId: 'm9',
    metadata: { resourceType: 'patient' },
    createdAt: iso,
    updatedAt: iso,
  };

  it('round-trips', () => {
    const record = toConversationRecord(conversation);
    expect(record.createdAt).toEqual(date);
    expect(record.updatedAt).toEqual(date);
    expect(fromConversationRecord(record)).toEqual(conversation);
  });
});

describe('message mapping', () => {
  const message = {
    id: 'm1',
    conversationId: 'c1',
    role: 'assistant' as const,
    status: 'complete' as const,
    parentMessageId: 'm0',
    runId: 'r1',
    model: 'model',
    provider: 'provider',
    parts: [{ id: 'p1', type: 'text', text: 'hi' }] as any,
    usage: { inputTokens: 1 } as any,
    compactedAt: iso,
    metadata: { a: 1 },
    createdAt: iso,
    updatedAt: iso,
  };

  it('round-trips with compactedAt', () => {
    const record = toMessageRecord(message as any);
    expect(record.compactedAt).toEqual(date);
    expect(fromMessageRecord(record)).toEqual(message);
  });

  it('leaves compactedAt undefined when absent', () => {
    const record = toMessageRecord({
      ...message,
      compactedAt: undefined,
    } as any);
    expect(record.compactedAt).toBeUndefined();
    expect(fromMessageRecord(record).compactedAt).toBeUndefined();
  });

  it('defaults missing parts to an empty array', () => {
    const record = toMessageRecord(message as any);
    expect(
      fromMessageRecord({ ...record, parts: undefined as any }).parts,
    ).toEqual([]);
  });
});

describe('run mapping', () => {
  const run = {
    id: 'r1',
    conversationId: 'c1',
    status: 'complete' as const,
    userMessageId: 'm1',
    assistantMessageId: 'm2',
    model: 'model',
    provider: 'provider',
    usage: { inputTokens: 2 } as any,
    errorMessage: 'boom',
    metadata: { b: 2 },
    startedAt: iso,
    completedAt: iso,
    updatedAt: iso,
  };

  it('round-trips with completedAt', () => {
    const record = toRunRecord(run as any);
    expect(record.completedAt).toEqual(date);
    expect(fromRunRecord(record)).toEqual(run);
  });

  it('leaves completedAt undefined when absent', () => {
    const record = toRunRecord({ ...run, completedAt: undefined } as any);
    expect(record.completedAt).toBeUndefined();
    expect(fromRunRecord(record).completedAt).toBeUndefined();
  });
});

describe('summary mapping', () => {
  it('round-trips', () => {
    const summary = {
      id: 's1',
      conversationId: 'c1',
      summaryMessageId: 'm5',
      startMessageId: 'm1',
      endMessageId: 'm4',
      tokenCount: 42,
      createdAt: iso,
      metadata: { c: 3 },
    };
    const record = toSummaryRecord(summary);
    expect(record.createdAt).toEqual(date);
    expect(fromSummaryRecord(record)).toEqual(summary);
  });
});

describe('prompt mapping', () => {
  const prompt = {
    id: 'p1',
    ownerParticipantId: 'u1',
    title: 'T',
    prompt: 'Hello {{name}}',
    parameters: [{ name: 'name' }] as any,
    metadata: { d: 4 },
    createdAt: iso,
    updatedAt: iso,
  };

  it('round-trips', () => {
    expect(fromPromptRecord(toPromptRecord(prompt))).toEqual(prompt);
  });

  it('defaults missing parameters to an empty array', () => {
    const record = toPromptRecord(prompt);
    expect(
      fromPromptRecord({ ...record, parameters: undefined as any }).parameters,
    ).toEqual([]);
  });
});

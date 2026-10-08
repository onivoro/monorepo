import { EntityManager } from 'typeorm';
import { AgenticConversationSummaryRecord } from '../entities/agentic-conversation-summary.entity';
import { AgenticConversationRecord } from '../entities/agentic-conversation.entity';
import { AgenticMessageRecord } from '../entities/agentic-message.entity';
import { AgenticPromptRecord } from '../entities/agentic-prompt.entity';
import { AgenticRunRecord } from '../entities/agentic-run.entity';
import { AgenticConversationRepository } from './agentic-conversation.repository';
import { AgenticMessageRepository } from './agentic-message.repository';
import { AgenticPromptRepository } from './agentic-prompt.repository';
import { agenticRepositories } from './agentic-repositories.constant';
import { AgenticRunRepository } from './agentic-run.repository';
import { AgenticSummaryRepository } from './agentic-summary.repository';
import { AgenticUsageRepository } from './agentic-usage.repository';
import { DefaultAgenticRepositories } from './default-agentic-repositories.service';

const iso = '2026-01-02T03:04:05.000Z';
const date = new Date(iso);

function fakeQueryBuilder(
  result: { many?: unknown[]; one?: unknown; count?: number } = {},
) {
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'limit',
    'update',
    'set',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  qb['getMany'] = jest.fn(async () => result.many ?? []);
  qb['getOne'] = jest.fn(async () => result.one);
  qb['getCount'] = jest.fn(async () => result.count ?? 0);
  qb['execute'] = jest.fn(async () => undefined);
  return qb;
}

function fakeEntityManager(qb = fakeQueryBuilder()) {
  const em = {
    insert: jest.fn(async () => undefined),
    findOneBy: jest.fn(async () => null as unknown),
    findOneByOrFail: jest.fn(async () => null as unknown),
    save: jest.fn(async (_entity: unknown, record: unknown) => record),
    update: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
    createQueryBuilder: jest.fn(() => qb),
  };
  return { em, qb, manager: em as unknown as EntityManager };
}

const conversationRecord = {
  id: 'c1',
  title: 'Title',
  status: 'active',
  participantIds: ['u1'],
  metadata: {},
  createdAt: date,
  updatedAt: date,
};

const messageRecord = () => ({
  id: 'm1',
  conversationId: 'c1',
  role: 'assistant',
  status: 'streaming',
  parts: [
    { id: 'p1', type: 'text', text: 'Hel' },
    { id: 'p2', type: 'reasoning', text: 'think' },
  ] as any[],
  createdAt: date,
  updatedAt: date,
});

describe('AgenticConversationRepository', () => {
  it('create inserts the record and returns the re-read row', async () => {
    const { em, manager } = fakeEntityManager();
    em.findOneByOrFail.mockResolvedValue(conversationRecord);
    const repo = new AgenticConversationRepository(manager);

    const result = await repo.create({
      ...conversationRecord,
      status: 'active',
      createdAt: iso,
      updatedAt: iso,
    });

    expect(em.insert).toHaveBeenCalledWith(
      AgenticConversationRecord,
      expect.objectContaining({ id: 'c1', createdAt: date }),
    );
    expect(em.findOneByOrFail).toHaveBeenCalledWith(AgenticConversationRecord, {
      id: 'c1',
    });
    expect(result.createdAt).toBe(iso);
  });

  it('get returns the mapped record or undefined', async () => {
    const { em, manager } = fakeEntityManager();
    const repo = new AgenticConversationRepository(manager);

    expect(await repo.get('missing')).toBeUndefined();

    em.findOneBy.mockResolvedValue(conversationRecord);
    expect(await repo.get('c1')).toEqual(
      expect.objectContaining({ id: 'c1', updatedAt: iso }),
    );
  });

  it('update saves and maps the saved row', async () => {
    const { em, manager } = fakeEntityManager();
    const repo = new AgenticConversationRepository(manager);
    const result = await repo.update({
      ...conversationRecord,
      status: 'archived',
      createdAt: iso,
      updatedAt: iso,
    });
    expect(em.save).toHaveBeenCalledWith(
      AgenticConversationRecord,
      expect.objectContaining({ status: 'archived', updatedAt: date }),
    );
    expect(result.status).toBe('archived');
  });

  it('list applies defaults: active status, limit 50, newest first', async () => {
    const qb = fakeQueryBuilder({ many: [conversationRecord] });
    const { em, manager } = fakeEntityManager(qb);
    const repo = new AgenticConversationRepository(manager);

    const result = await repo.list();

    expect(em.createQueryBuilder).toHaveBeenCalledWith(
      AgenticConversationRecord,
      'conversation',
    );
    expect(qb['orderBy']).toHaveBeenCalledWith(
      'conversation.updatedAt',
      'DESC',
    );
    expect(qb['limit']).toHaveBeenCalledWith(50);
    expect(qb['where']).toHaveBeenCalledWith('conversation.status = :status', {
      status: 'active',
    });
    expect(qb['andWhere']).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].createdAt).toBe(iso);
  });

  it.each([
    [0, 1],
    [-5, 1],
    [500, 100],
    [25, 25],
  ])('list clamps limit %p to %p', async (limit, expected) => {
    const qb = fakeQueryBuilder();
    const { manager } = fakeEntityManager(qb);
    await new AgenticConversationRepository(manager).list({ limit });
    expect(qb['limit']).toHaveBeenCalledWith(expected);
  });

  it('list adds every optional filter', async () => {
    const qb = fakeQueryBuilder();
    const { manager } = fakeEntityManager(qb);
    await new AgenticConversationRepository(manager).list({
      status: 'archived',
      participantId: 'u1',
      resourceType: 'patient',
      resourceId: 'p-1',
      search: '  needle  ',
    });

    expect(qb['where']).toHaveBeenCalledWith('conversation.status = :status', {
      status: 'archived',
    });
    expect(qb['andWhere']).toHaveBeenCalledWith(
      'conversation.participantIds @> :participantIds',
      { participantIds: '["u1"]' },
    );
    expect(qb['andWhere']).toHaveBeenCalledWith(
      "conversation.metadata ->> 'resourceType' = :resourceType",
      { resourceType: 'patient' },
    );
    expect(qb['andWhere']).toHaveBeenCalledWith(
      "conversation.metadata ->> 'resourceId' = :resourceId",
      { resourceId: 'p-1' },
    );
    expect(qb['andWhere']).toHaveBeenCalledWith(expect.any(String), {
      search: '%needle%',
    });
  });

  it('list ignores a whitespace-only search', async () => {
    const qb = fakeQueryBuilder();
    const { manager } = fakeEntityManager(qb);
    await new AgenticConversationRepository(manager).list({ search: '   ' });
    expect(qb['andWhere']).not.toHaveBeenCalled();
  });
});

describe('AgenticMessageRepository', () => {
  const message = {
    ...messageRecord(),
    role: 'assistant' as const,
    status: 'streaming' as const,
    createdAt: iso,
    updatedAt: iso,
  };

  it('create and update save the mapped record', async () => {
    const { em, manager } = fakeEntityManager();
    const repo = new AgenticMessageRepository(manager);

    expect((await repo.create(message as any)).id).toBe('m1');
    expect((await repo.update(message as any)).updatedAt).toBe(iso);
    expect(em.save).toHaveBeenCalledTimes(2);
    expect(em.save).toHaveBeenCalledWith(
      AgenticMessageRecord,
      expect.objectContaining({ id: 'm1', createdAt: date }),
    );
  });

  it('get scopes the lookup to the conversation', async () => {
    const { em, manager } = fakeEntityManager();
    const repo = new AgenticMessageRepository(manager);

    expect(await repo.get('c1', 'missing')).toBeUndefined();
    expect(em.findOneBy).toHaveBeenCalledWith(AgenticMessageRecord, {
      conversationId: 'c1',
      id: 'missing',
    });

    em.findOneBy.mockResolvedValue(messageRecord());
    expect((await repo.get('c1', 'm1'))?.id).toBe('m1');
  });

  it('listByConversationId excludes compacted messages by default', async () => {
    const qb = fakeQueryBuilder({ many: [messageRecord()] });
    const { manager } = fakeEntityManager(qb);
    const result = await new AgenticMessageRepository(
      manager,
    ).listByConversationId('c1');

    expect(qb['where']).toHaveBeenCalledWith(
      'message.conversationId = :conversationId',
      { conversationId: 'c1' },
    );
    expect(qb['orderBy']).toHaveBeenCalledWith('message.createdAt', 'ASC');
    expect(qb['addOrderBy']).toHaveBeenCalledWith(
      expect.stringContaining('CASE message.role'),
      'ASC',
    );
    expect(qb['andWhere']).toHaveBeenCalledTimes(1);
    expect(qb['andWhere']).toHaveBeenCalledWith('message.compactedAt IS NULL');
    expect(qb['limit']).not.toHaveBeenCalled();
    expect(result[0].createdAt).toBe(iso);
  });

  it('listByConversationId applies cursor, limit and includeCompacted', async () => {
    const qb = fakeQueryBuilder();
    const { manager } = fakeEntityManager(qb);
    await new AgenticMessageRepository(manager).listByConversationId('c1', {
      includeCompacted: true,
      afterMessageId: 'a',
      beforeMessageId: 'b',
      limit: 10,
    });

    expect(qb['andWhere']).not.toHaveBeenCalledWith(
      'message.compactedAt IS NULL',
    );
    expect(qb['andWhere']).toHaveBeenCalledWith(
      expect.stringContaining('message.createdAt >'),
      { afterMessageId: 'a' },
    );
    expect(qb['andWhere']).toHaveBeenCalledWith(
      expect.stringContaining('message.createdAt <'),
      { beforeMessageId: 'b' },
    );
    expect(qb['limit']).toHaveBeenCalledWith(10);
  });

  it('listNewestByConversationId orders descending', async () => {
    const qb = fakeQueryBuilder();
    const { manager } = fakeEntityManager(qb);
    const repo = new AgenticMessageRepository(manager);

    await repo.listNewestByConversationId('c1');
    expect(qb['orderBy']).toHaveBeenCalledWith('message.createdAt', 'DESC');
    expect(qb['andWhere']).toHaveBeenCalledWith('message.compactedAt IS NULL');
    expect(qb['limit']).not.toHaveBeenCalled();

    qb['andWhere'].mockClear();
    await repo.listNewestByConversationId('c1', {
      includeCompacted: true,
      limit: 3,
    });
    expect(qb['andWhere']).not.toHaveBeenCalled();
    expect(qb['limit']).toHaveBeenCalledWith(3);
  });

  it('countByConversationId honours includeCompacted', async () => {
    const qb = fakeQueryBuilder({ count: 7 });
    const { manager } = fakeEntityManager(qb);
    const repo = new AgenticMessageRepository(manager);

    expect(await repo.countByConversationId('c1')).toBe(7);
    expect(qb['andWhere']).toHaveBeenCalledWith('message.compactedAt IS NULL');

    qb['andWhere'].mockClear();
    await repo.countByConversationId('c1', { includeCompacted: true });
    expect(qb['andWhere']).not.toHaveBeenCalled();
  });

  it('upsertPart replaces an existing part in place', async () => {
    const { em, manager } = fakeEntityManager();
    em.findOneBy.mockResolvedValue(messageRecord());
    await new AgenticMessageRepository(manager).upsertPart('c1', 'm1', {
      id: 'p1',
      type: 'text',
      text: 'Hello',
    } as any);

    const saved = em.save.mock.calls[0][1] as any;
    expect(saved.parts.map((p: any) => p.id)).toEqual(['p1', 'p2']);
    expect(saved.parts[0].text).toBe('Hello');
    expect(saved.updatedAt).toBeInstanceOf(Date);
    expect(saved.updatedAt).not.toBe(date);
  });

  it('upsertPart appends a new part', async () => {
    const { em, manager } = fakeEntityManager();
    em.findOneBy.mockResolvedValue(messageRecord());
    await new AgenticMessageRepository(manager).upsertPart('c1', 'm1', {
      id: 'p3',
      type: 'text',
      text: 'new',
    } as any);
    const saved = em.save.mock.calls[0][1] as any;
    expect(saved.parts.map((p: any) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('appendPartDelta concatenates onto the target part only', async () => {
    const { em, manager } = fakeEntityManager();
    em.findOneBy.mockResolvedValue(messageRecord());
    await new AgenticMessageRepository(manager).appendPartDelta(
      'c1',
      'm1',
      'p1',
      'text',
      'lo',
    );
    const saved = em.save.mock.calls[0][1] as any;
    expect(saved.parts[0].text).toBe('Hello');
    expect(typeof saved.parts[0].updatedAt).toBe('string');
    expect(saved.parts[1]).toEqual({
      id: 'p2',
      type: 'reasoning',
      text: 'think',
    });
  });

  it('appendPartDelta starts from an empty string when the field is unset', async () => {
    const { em, manager } = fakeEntityManager();
    em.findOneBy.mockResolvedValue(messageRecord());
    await new AgenticMessageRepository(manager).appendPartDelta(
      'c1',
      'm1',
      'p2',
      'argumentsText' as any,
      '{"a"',
    );
    const saved = em.save.mock.calls[0][1] as any;
    expect(saved.parts[1].argumentsText).toBe('{"a"');
  });

  it('upsertPart and appendPartDelta throw when the message is missing', async () => {
    const { em, manager } = fakeEntityManager();
    const repo = new AgenticMessageRepository(manager);
    await expect(
      repo.upsertPart('c1', 'nope', { id: 'p' } as any),
    ).rejects.toThrow('Agentic message "nope" was not found.');
    await expect(
      repo.appendPartDelta('c1', 'nope', 'p', 'text', 'x'),
    ).rejects.toThrow('Agentic message "nope" was not found.');
    expect(em.save).not.toHaveBeenCalled();
  });
});

describe('AgenticPromptRepository', () => {
  const prompt = {
    id: 'p1',
    ownerParticipantId: 'u1',
    title: 'T',
    prompt: 'body',
    parameters: [],
    createdAt: iso,
    updatedAt: iso,
  };

  it('create saves the mapped record', async () => {
    const { em, manager } = fakeEntityManager();
    const result = await new AgenticPromptRepository(manager).create(prompt);
    expect(em.save).toHaveBeenCalledWith(
      AgenticPromptRecord,
      expect.objectContaining({ id: 'p1', createdAt: date }),
    );
    expect(result).toEqual(prompt);
  });

  it('getForOwner scopes by owner', async () => {
    const { em, manager } = fakeEntityManager();
    const repo = new AgenticPromptRepository(manager);
    expect(await repo.getForOwner('p1', 'u2')).toBeUndefined();
    expect(em.findOneBy).toHaveBeenCalledWith(AgenticPromptRecord, {
      id: 'p1',
      ownerParticipantId: 'u2',
    });
    em.findOneBy.mockResolvedValue({
      ...prompt,
      createdAt: date,
      updatedAt: date,
    });
    expect(await repo.getForOwner('p1', 'u1')).toEqual(prompt);
  });

  it('listForOwner defaults the limit and skips search', async () => {
    const qb = fakeQueryBuilder({
      many: [{ ...prompt, createdAt: date, updatedAt: date }],
    });
    const { manager } = fakeEntityManager(qb);
    const result = await new AgenticPromptRepository(manager).listForOwner({
      ownerParticipantId: 'u1',
    });
    expect(qb['where']).toHaveBeenCalledWith(
      'prompt.ownerParticipantId = :ownerParticipantId',
      { ownerParticipantId: 'u1' },
    );
    expect(qb['limit']).toHaveBeenCalledWith(100);
    expect(qb['andWhere']).not.toHaveBeenCalled();
    expect(result).toEqual([prompt]);
  });

  it.each([
    [0, 1],
    [1000, 200],
  ])('listForOwner clamps limit %p to %p', async (limit, expected) => {
    const qb = fakeQueryBuilder();
    const { manager } = fakeEntityManager(qb);
    await new AgenticPromptRepository(manager).listForOwner({
      ownerParticipantId: 'u1',
      limit,
    });
    expect(qb['limit']).toHaveBeenCalledWith(expected);
  });

  it('listForOwner escapes ILIKE wildcards in the search term', async () => {
    const qb = fakeQueryBuilder();
    const { manager } = fakeEntityManager(qb);
    await new AgenticPromptRepository(manager).listForOwner({
      ownerParticipantId: 'u1',
      search: ' 50%_off\\ ',
    });
    expect(qb['andWhere']).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE :search'),
      { search: '%50\\%\\_off\\\\%' },
    );
  });

  it('updateForOwner updates only the owner row and returns the mapped prompt', async () => {
    const qb = fakeQueryBuilder();
    const { manager } = fakeEntityManager(qb);
    const result = await new AgenticPromptRepository(manager).updateForOwner(
      prompt,
    );
    expect(qb['update']).toHaveBeenCalledWith(AgenticPromptRecord);
    expect(qb['set']).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', updatedAt: date }),
    );
    expect(qb['where']).toHaveBeenCalledWith(
      'id = :id AND ownerParticipantId = :ownerParticipantId',
      { id: 'p1', ownerParticipantId: 'u1' },
    );
    expect(qb['execute']).toHaveBeenCalled();
    expect(result).toEqual(prompt);
  });

  it('deleteForOwner deletes by id and owner', async () => {
    const { em, manager } = fakeEntityManager();
    await new AgenticPromptRepository(manager).deleteForOwner('p1', 'u1');
    expect(em.delete).toHaveBeenCalledWith(AgenticPromptRecord, {
      id: 'p1',
      ownerParticipantId: 'u1',
    });
  });
});

describe('AgenticRunRepository', () => {
  const run = {
    id: 'r1',
    conversationId: 'c1',
    status: 'running' as const,
    userMessageId: 'm1',
    startedAt: iso,
    updatedAt: iso,
  };

  it('create, update and get map records', async () => {
    const { em, manager } = fakeEntityManager();
    const repo = new AgenticRunRepository(manager);

    expect((await repo.create(run as any)).startedAt).toBe(iso);
    expect((await repo.update(run as any)).id).toBe('r1');
    expect(em.save).toHaveBeenCalledWith(
      AgenticRunRecord,
      expect.objectContaining({ id: 'r1', startedAt: date }),
    );

    expect(await repo.get('r1')).toBeUndefined();
    em.findOneBy.mockResolvedValue({
      ...run,
      startedAt: date,
      updatedAt: date,
    });
    expect((await repo.get('r1'))?.status).toBe('running');
    expect(em.findOneBy).toHaveBeenCalledWith(AgenticRunRecord, { id: 'r1' });
  });
});

describe('AgenticSummaryRepository', () => {
  const summary = {
    id: 's1',
    conversationId: 'c1',
    summaryMessageId: 'm5',
    startMessageId: 'm1',
    endMessageId: 'm4',
    tokenCount: 10,
    createdAt: iso,
  };

  it('getLatest returns the newest summary or undefined', async () => {
    const qb = fakeQueryBuilder();
    const { em, manager } = fakeEntityManager(qb);
    const repo = new AgenticSummaryRepository(manager);

    expect(await repo.getLatest('c1')).toBeUndefined();
    expect(em.createQueryBuilder).toHaveBeenCalledWith(
      AgenticConversationSummaryRecord,
      'summary',
    );
    expect(qb['orderBy']).toHaveBeenCalledWith('summary.createdAt', 'DESC');

    qb['getOne'].mockResolvedValue({ ...summary, createdAt: date });
    expect(await repo.getLatest('c1')).toEqual(summary);
  });

  it('create saves the mapped record', async () => {
    const { em, manager } = fakeEntityManager();
    expect(await new AgenticSummaryRepository(manager).create(summary)).toEqual(
      summary,
    );
    expect(em.save).toHaveBeenCalledWith(
      AgenticConversationSummaryRecord,
      expect.objectContaining({ createdAt: date }),
    );
  });
});

describe('AgenticUsageRepository', () => {
  it('records message and run usage', async () => {
    const { em, manager } = fakeEntityManager();
    const repo = new AgenticUsageRepository(manager);
    const usage = { inputTokens: 1, outputTokens: 2 } as any;

    await repo.recordMessageUsage('m1', usage);
    await repo.recordRunUsage('r1', usage);

    expect(em.update).toHaveBeenNthCalledWith(
      1,
      AgenticMessageRecord,
      { id: 'm1' },
      { usage, updatedAt: expect.any(Date) },
    );
    expect(em.update).toHaveBeenNthCalledWith(
      2,
      AgenticRunRecord,
      { id: 'r1' },
      { usage, updatedAt: expect.any(Date) },
    );
  });
});

describe('DefaultAgenticRepositories', () => {
  it('exposes each repository under its contract name', () => {
    const { manager } = fakeEntityManager();
    const conversations = new AgenticConversationRepository(manager);
    const messages = new AgenticMessageRepository(manager);
    const prompts = new AgenticPromptRepository(manager);
    const runs = new AgenticRunRepository(manager);
    const usage = new AgenticUsageRepository(manager);
    const summaries = new AgenticSummaryRepository(manager);

    const repos = new DefaultAgenticRepositories(
      conversations,
      messages,
      prompts,
      runs,
      usage,
      summaries,
    );

    expect(repos).toMatchObject({
      conversations,
      messages,
      prompts,
      runs,
      usage,
      summaries,
    });
  });

  it('agenticRepositories lists every provider', () => {
    expect(agenticRepositories).toEqual([
      AgenticConversationRepository,
      AgenticMessageRepository,
      AgenticPromptRepository,
      AgenticRunRepository,
      AgenticSummaryRepository,
      AgenticUsageRepository,
      DefaultAgenticRepositories,
    ]);
  });
});

import 'reflect-metadata';
import { Column, DataSource, Entity } from 'typeorm';
import { AgenticConversationColumns } from './agentic-conversation.entity';
import { AgenticMessageColumns } from './agentic-message.entity';
import { agenticEntities } from './agentic-entities.constant';

/**
 * A consumer whose schema carries more than this package knows about.
 *
 * This is the case the abstract bases exist for: the column has to be part of
 * the entity, not merely present in the database, or the ORM will neither
 * write it on insert nor see it on read.
 */
@Entity('agentic_conversations')
class TenantScopedConversation extends AgenticConversationColumns {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;
}

@Entity('agentic_messages')
class TenantScopedMessage extends AgenticMessageColumns {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;
}

async function columnsOf(entities: unknown[]): Promise<Map<string, string[]>> {
  // Metadata only; this DataSource never connects.
  const offline = new DataSource({
    type: 'postgres',
    entities: entities as never,
    synchronize: false,
  });
  await (
    offline as unknown as { buildMetadatas(): Promise<void> }
  ).buildMetadatas();

  return new Map(
    offline.entityMetadatas.map((m) => [
      m.tableName,
      m.columns.map((c) => c.databaseName).sort(),
    ]),
  );
}

describe('entity extension', () => {
  it('maps a subclass column alongside the inherited ones', async () => {
    const byTable = await columnsOf([TenantScopedConversation]);
    const columns = byTable.get('agentic_conversations') ?? [];

    expect(columns).toContain('tenant_id');
    // the base's own columns survive the subclassing
    expect(columns).toEqual(
      expect.arrayContaining(['id', 'status', 'created_at', 'updated_at']),
    );
  });

  it('keeps the extra column out of the shipped entity', async () => {
    const byTable = await columnsOf(agenticEntities);

    expect(byTable.get('agentic_conversations')).not.toContain('tenant_id');
  });

  it('extends every table a consumer is likely to scope', async () => {
    const byTable = await columnsOf([
      TenantScopedConversation,
      TenantScopedMessage,
    ]);

    expect(byTable.get('agentic_conversations')).toContain('tenant_id');
    expect(byTable.get('agentic_messages')).toContain('tenant_id');
  });

  // the shipped entities remain usable as-is for a schema that needs nothing
  // added, which is what keeps the split from being a tax on the simple case
  it('ships concrete entities for all five tables', async () => {
    const byTable = await columnsOf(agenticEntities);

    expect([...byTable.keys()].sort()).toEqual([
      'agentic_conversation_summaries',
      'agentic_conversations',
      'agentic_messages',
      'agentic_prompts',
      'agentic_runs',
    ]);
  });
});

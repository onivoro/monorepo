import { JsonObject } from '@onivoro/isomorphic-agentic';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('agentic_conversation_summaries')
@Index('idx_agentic_summaries_conversation_created', [
  'conversationId',
  'createdAt',
])
export class AgenticConversationSummaryRecord {
  @PrimaryColumn('text')
  id: string;

  @Column({ name: 'conversation_id', type: 'text' })
  conversationId: string;

  @Column({ name: 'summary_message_id', type: 'text' })
  summaryMessageId: string;

  @Column({ name: 'start_message_id', type: 'text' })
  startMessageId: string;

  @Column({ name: 'end_message_id', type: 'text' })
  endMessageId: string;

  @Column({ name: 'token_count', nullable: true, type: 'integer' })
  tokenCount?: number;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ nullable: true, type: 'jsonb' })
  metadata?: JsonObject;
}

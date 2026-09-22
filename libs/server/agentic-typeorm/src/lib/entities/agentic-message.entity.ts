import {
  AgenticPart,
  AgenticUsage,
  JsonObject,
} from '@onivoro/isomorphic-agentic';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('agentic_messages')
@Index('idx_agentic_messages_conversation_created', [
  'conversationId',
  'createdAt',
])
@Index('idx_agentic_messages_run_id', ['runId'])
export class AgenticMessageRecord {
  @PrimaryColumn('text')
  id: string;

  @Column({ name: 'conversation_id', type: 'text' })
  conversationId: string;

  @Column({ type: 'text' })
  role: string;

  @Column({ type: 'text' })
  status: string;

  @Column({ name: 'parent_message_id', nullable: true, type: 'text' })
  parentMessageId?: string;

  @Column({ name: 'run_id', nullable: true, type: 'text' })
  runId?: string;

  @Column({ nullable: true, type: 'text' })
  model?: string;

  @Column({ nullable: true, type: 'text' })
  provider?: string;

  @Column({ type: 'jsonb' })
  parts: AgenticPart[];

  @Column({ nullable: true, type: 'jsonb' })
  usage?: AgenticUsage;

  @Column({ name: 'compacted_at', nullable: true, type: 'timestamptz' })
  compactedAt?: Date;

  @Column({ nullable: true, type: 'jsonb' })
  metadata?: JsonObject;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

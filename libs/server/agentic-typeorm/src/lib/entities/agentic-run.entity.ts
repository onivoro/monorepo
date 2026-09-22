import { AgenticUsage, JsonObject } from '@onivoro/isomorphic-agentic';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('agentic_runs')
@Index('idx_agentic_runs_conversation_started', ['conversationId', 'startedAt'])
export class AgenticRunRecord {
  @PrimaryColumn('text')
  id: string;

  @Column({ name: 'conversation_id', type: 'text' })
  conversationId: string;

  @Column({ type: 'text' })
  status: string;

  @Column({ name: 'user_message_id', nullable: true, type: 'text' })
  userMessageId?: string;

  @Column({ name: 'assistant_message_id', nullable: true, type: 'text' })
  assistantMessageId?: string;

  @Column({ nullable: true, type: 'text' })
  model?: string;

  @Column({ nullable: true, type: 'text' })
  provider?: string;

  @Column({ nullable: true, type: 'jsonb' })
  usage?: AgenticUsage;

  @Column({ name: 'error_message', nullable: true, type: 'text' })
  errorMessage?: string;

  @Column({ nullable: true, type: 'jsonb' })
  metadata?: JsonObject;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true, type: 'timestamptz' })
  completedAt?: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

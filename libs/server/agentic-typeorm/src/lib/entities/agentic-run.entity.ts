import { AgenticUsage, JsonObject } from '@onivoro/isomorphic-agentic';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * The columns this table carries, without the mapping.
 *
 * Split out so a consumer whose schema needs more -- a tenant column, a soft
 * delete, an owning organisation -- can subclass and add them. TypeORM treats
 * an abstract base's columns as the subclass's own, so the extra column is a
 * first-class part of the entity rather than something the ORM cannot see.
 *
 * Extend this and declare your own `@Entity()`; use AgenticRunRecord as-is when the
 * schema needs nothing added.
 */
export abstract class AgenticRunColumns {
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

@Entity('agentic_runs')
@Index('idx_agentic_runs_conversation_started', ['conversationId', 'startedAt'])
export class AgenticRunRecord extends AgenticRunColumns {}

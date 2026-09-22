import { JsonObject } from '@onivoro/isomorphic-agentic';
import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * The columns this table carries, without the mapping.
 *
 * Split out so a consumer whose schema needs more -- a tenant column, a soft
 * delete, an owning organisation -- can subclass and add them. TypeORM treats
 * an abstract base's columns as the subclass's own, so the extra column is a
 * first-class part of the entity rather than something the ORM cannot see.
 *
 * Extend this and declare your own `@Entity()`; use AgenticConversationRecord as-is when the
 * schema needs nothing added.
 */
export abstract class AgenticConversationColumns {
  @PrimaryColumn('text')
  id: string;

  @Column({ nullable: true, type: 'text' })
  title?: string;

  @Column({ type: 'text' })
  status: string;

  @Column({ name: 'participant_ids', nullable: true, type: 'jsonb' })
  participantIds?: string[];

  @Column({ name: 'latest_summary_message_id', nullable: true, type: 'text' })
  latestSummaryMessageId?: string;

  @Column({ nullable: true, type: 'jsonb' })
  metadata?: JsonObject;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('agentic_conversations')
export class AgenticConversationRecord extends AgenticConversationColumns {}

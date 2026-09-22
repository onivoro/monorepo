import { JsonObject } from '@onivoro/isomorphic-agentic';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('agentic_conversations')
export class AgenticConversationRecord {
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

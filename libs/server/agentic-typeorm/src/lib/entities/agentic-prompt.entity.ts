import {
  AgenticPromptParameter,
  JsonObject,
} from '@onivoro/isomorphic-agentic';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('agentic_prompts')
export class AgenticPromptRecord {
  @PrimaryColumn('text')
  id: string;

  @Column({ name: 'owner_participant_id', type: 'text' })
  ownerParticipantId: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ default: () => "'[]'::jsonb", type: 'jsonb' })
  parameters: AgenticPromptParameter[];

  @Column({ nullable: true, type: 'jsonb' })
  metadata?: JsonObject;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

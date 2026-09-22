import {
  AgenticConversation,
  AgenticConversationListOptions,
  AgenticConversationRepository as AgenticConversationRepositoryContract,
} from '@onivoro/isomorphic-agentic';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AgenticConversationRecord } from '../entities/agentic-conversation.entity';
import {
  fromConversationRecord,
  toConversationRecord,
} from './agentic-mappers';

@Injectable()
export class AgenticConversationRepository
  implements AgenticConversationRepositoryContract
{
  constructor(private readonly entityManager: EntityManager) {}

  async create(
    conversation: AgenticConversation,
  ): Promise<AgenticConversation> {
    const record = toConversationRecord(conversation);
    await this.entityManager.insert(AgenticConversationRecord, record as any);

    const created = await this.entityManager.findOneByOrFail(
      AgenticConversationRecord,
      { id: conversation.id },
    );
    return fromConversationRecord(created);
  }

  async get(conversationId: string): Promise<AgenticConversation | undefined> {
    const record = await this.entityManager.findOneBy(
      AgenticConversationRecord,
      { id: conversationId },
    );
    return record ? fromConversationRecord(record) : undefined;
  }

  async update(
    conversation: AgenticConversation,
  ): Promise<AgenticConversation> {
    const saved = await this.entityManager.save(
      AgenticConversationRecord,
      toConversationRecord(conversation),
    );
    return fromConversationRecord(saved);
  }

  async list(
    options: AgenticConversationListOptions = {},
  ): Promise<AgenticConversation[]> {
    const query = this.entityManager
      .createQueryBuilder(AgenticConversationRecord, 'conversation')
      .orderBy('conversation.updatedAt', 'DESC')
      .limit(Math.min(Math.max(options.limit ?? 50, 1), 100));

    query.where('conversation.status = :status', {
      status: options.status ?? 'active',
    });

    if (options.participantId) {
      query.andWhere('conversation.participantIds @> :participantIds', {
        participantIds: JSON.stringify([options.participantId]),
      });
    }

    if (options.resourceType) {
      query.andWhere(
        "conversation.metadata ->> 'resourceType' = :resourceType",
        { resourceType: options.resourceType },
      );
    }

    if (options.resourceId) {
      query.andWhere("conversation.metadata ->> 'resourceId' = :resourceId", {
        resourceId: options.resourceId,
      });
    }

    const search = options.search?.trim();
    if (search) {
      query.andWhere(
        `(
          conversation.id ILIKE :search OR
          conversation.title ILIKE :search OR
          EXISTS (
            SELECT 1
            FROM agentic_messages message
            WHERE message.conversation_id = conversation.id
              AND message.parts::text ILIKE :search
          )
        )`,
        { search: `%${search}%` },
      );
    }

    return (await query.getMany()).map(fromConversationRecord);
  }
}

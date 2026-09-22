import {
  AgenticDeltaField,
  AgenticMessage,
  AgenticMessageListOptions,
  AgenticMessageRepository as AgenticMessageRepositoryContract,
  AgenticPart,
} from '@onivoro/isomorphic-agentic';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AgenticMessageRecord } from '../entities/agentic-message.entity';
import { fromMessageRecord, toMessageRecord } from './agentic-mappers';

const chronologicalRoleOrder = `CASE message.role WHEN 'system' THEN 0 WHEN 'summary' THEN 0 WHEN 'user' THEN 1 WHEN 'assistant' THEN 2 WHEN 'tool' THEN 3 ELSE 4 END`;

@Injectable()
export class AgenticMessageRepository
  implements AgenticMessageRepositoryContract
{
  constructor(private readonly entityManager: EntityManager) {}

  async create(message: AgenticMessage): Promise<AgenticMessage> {
    const saved = await this.entityManager.save(
      AgenticMessageRecord,
      toMessageRecord(message),
    );
    return fromMessageRecord(saved);
  }

  async update(message: AgenticMessage): Promise<AgenticMessage> {
    const saved = await this.entityManager.save(
      AgenticMessageRecord,
      toMessageRecord(message),
    );
    return fromMessageRecord(saved);
  }

  async get(
    conversationId: string,
    messageId: string,
  ): Promise<AgenticMessage | undefined> {
    const record = await this.entityManager.findOneBy(AgenticMessageRecord, {
      conversationId,
      id: messageId,
    });
    return record ? fromMessageRecord(record) : undefined;
  }

  async listByConversationId(
    conversationId: string,
    options: AgenticMessageListOptions = {},
  ): Promise<AgenticMessage[]> {
    const query = this.entityManager
      .createQueryBuilder(AgenticMessageRecord, 'message')
      .where('message.conversationId = :conversationId', { conversationId })
      .orderBy('message.createdAt', 'ASC')
      .addOrderBy(chronologicalRoleOrder, 'ASC')
      .addOrderBy('message.id', 'ASC');

    if (!options.includeCompacted) {
      query.andWhere('message.compactedAt IS NULL');
    }
    if (options.afterMessageId) {
      query.andWhere(
        'message.createdAt > (SELECT after_message.created_at FROM agentic_messages after_message WHERE after_message.id = :afterMessageId)',
        { afterMessageId: options.afterMessageId },
      );
    }
    if (options.beforeMessageId) {
      query.andWhere(
        'message.createdAt < (SELECT before_message.created_at FROM agentic_messages before_message WHERE before_message.id = :beforeMessageId)',
        { beforeMessageId: options.beforeMessageId },
      );
    }
    if (options.limit) {
      query.limit(options.limit);
    }

    return (await query.getMany()).map(fromMessageRecord);
  }

  async listNewestByConversationId(
    conversationId: string,
    options: AgenticMessageListOptions = {},
  ): Promise<AgenticMessage[]> {
    const query = this.entityManager
      .createQueryBuilder(AgenticMessageRecord, 'message')
      .where('message.conversationId = :conversationId', { conversationId })
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy(chronologicalRoleOrder, 'DESC')
      .addOrderBy('message.id', 'DESC');

    if (!options.includeCompacted) {
      query.andWhere('message.compactedAt IS NULL');
    }
    if (options.limit) {
      query.limit(options.limit);
    }

    return (await query.getMany()).map(fromMessageRecord);
  }

  async countByConversationId(
    conversationId: string,
    options: Pick<AgenticMessageListOptions, 'includeCompacted'> = {},
  ): Promise<number> {
    const query = this.entityManager
      .createQueryBuilder(AgenticMessageRecord, 'message')
      .where('message.conversationId = :conversationId', { conversationId });

    if (!options.includeCompacted) {
      query.andWhere('message.compactedAt IS NULL');
    }

    return query.getCount();
  }

  async upsertPart(
    conversationId: string,
    messageId: string,
    part: AgenticPart,
  ): Promise<void> {
    const message = await this.getRequiredRecord(conversationId, messageId);
    const index = message.parts.findIndex(
      (candidate) => candidate.id === part.id,
    );
    message.parts =
      index === -1
        ? [...message.parts, part]
        : [
            ...message.parts.slice(0, index),
            part,
            ...message.parts.slice(index + 1),
          ];
    message.updatedAt = new Date();
    await this.entityManager.save(AgenticMessageRecord, message);
  }

  async appendPartDelta(
    conversationId: string,
    messageId: string,
    partId: string,
    field: AgenticDeltaField,
    delta: string,
  ): Promise<void> {
    const message = await this.getRequiredRecord(conversationId, messageId);
    message.parts = message.parts.map((part) =>
      part.id === partId
        ? ({
            ...part,
            [field]: `${String(
              (part as unknown as Record<string, unknown>)[field] ?? '',
            )}${delta}`,
            updatedAt: new Date().toISOString(),
          } as AgenticPart)
        : part,
    );
    message.updatedAt = new Date();
    await this.entityManager.save(AgenticMessageRecord, message);
  }

  private async getRequiredRecord(
    conversationId: string,
    messageId: string,
  ): Promise<AgenticMessageRecord> {
    const message = await this.entityManager.findOneBy(AgenticMessageRecord, {
      conversationId,
      id: messageId,
    });
    if (!message) {
      throw new Error(`Agentic message "${messageId}" was not found.`);
    }
    return message;
  }
}

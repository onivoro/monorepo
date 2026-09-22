import {
  AgenticConversationSummary,
  AgenticSummaryRepository as AgenticSummaryRepositoryContract,
} from '@onivoro/isomorphic-agentic';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AgenticConversationSummaryRecord } from '../entities/agentic-conversation-summary.entity';
import { fromSummaryRecord, toSummaryRecord } from './agentic-mappers';

@Injectable()
export class AgenticSummaryRepository
  implements AgenticSummaryRepositoryContract
{
  constructor(private readonly entityManager: EntityManager) {}

  async getLatest(
    conversationId: string,
  ): Promise<AgenticConversationSummary | undefined> {
    const record = await this.entityManager
      .createQueryBuilder(AgenticConversationSummaryRecord, 'summary')
      .where('summary.conversationId = :conversationId', { conversationId })
      .orderBy('summary.createdAt', 'DESC')
      .getOne();
    return record ? fromSummaryRecord(record) : undefined;
  }

  async create(
    summary: AgenticConversationSummary,
  ): Promise<AgenticConversationSummary> {
    const saved = await this.entityManager.save(
      AgenticConversationSummaryRecord,
      toSummaryRecord(summary),
    );
    return fromSummaryRecord(saved);
  }
}

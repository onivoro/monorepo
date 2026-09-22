import {
  AgenticUsage,
  AgenticUsageRepository as AgenticUsageRepositoryContract,
} from '@onivoro/isomorphic-agentic';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AgenticMessageRecord } from '../entities/agentic-message.entity';
import { AgenticRunRecord } from '../entities/agentic-run.entity';

@Injectable()
export class AgenticUsageRepository implements AgenticUsageRepositoryContract {
  constructor(private readonly entityManager: EntityManager) {}

  async recordMessageUsage(
    messageId: string,
    usage: AgenticUsage,
  ): Promise<void> {
    await this.entityManager.update(
      AgenticMessageRecord,
      { id: messageId },
      { usage: usage as any, updatedAt: new Date() },
    );
  }

  async recordRunUsage(runId: string, usage: AgenticUsage): Promise<void> {
    await this.entityManager.update(
      AgenticRunRecord,
      { id: runId },
      { usage: usage as any, updatedAt: new Date() },
    );
  }
}

import {
  AgenticPrompt,
  AgenticPromptListOptions,
  AgenticPromptRepository as AgenticPromptRepositoryContract,
} from '@onivoro/isomorphic-agentic';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AgenticPromptRecord } from '../entities/agentic-prompt.entity';
import { fromPromptRecord, toPromptRecord } from './agentic-mappers';

@Injectable()
export class AgenticPromptRepository
  implements AgenticPromptRepositoryContract
{
  constructor(private readonly entityManager: EntityManager) {}

  async create(prompt: AgenticPrompt): Promise<AgenticPrompt> {
    const saved = await this.entityManager.save(
      AgenticPromptRecord,
      toPromptRecord(prompt),
    );
    return fromPromptRecord(saved);
  }

  async getForOwner(
    promptId: string,
    ownerParticipantId: string,
  ): Promise<AgenticPrompt | undefined> {
    const record = await this.entityManager.findOneBy(AgenticPromptRecord, {
      id: promptId,
      ownerParticipantId,
    });
    return record ? fromPromptRecord(record) : undefined;
  }

  async listForOwner(
    options: AgenticPromptListOptions,
  ): Promise<AgenticPrompt[]> {
    const query = this.entityManager
      .createQueryBuilder(AgenticPromptRecord, 'prompt')
      .where('prompt.ownerParticipantId = :ownerParticipantId', {
        ownerParticipantId: options.ownerParticipantId,
      })
      .orderBy('prompt.updatedAt', 'DESC')
      .limit(Math.min(Math.max(options.limit ?? 100, 1), 200));

    const search = options.search?.trim();
    if (search) {
      query.andWhere(
        `(prompt.title ILIKE :search OR prompt.prompt ILIKE :search)`,
        { search: `%${escapeIlike(search)}%` },
      );
    }

    return (await query.getMany()).map(fromPromptRecord);
  }

  async updateForOwner(prompt: AgenticPrompt): Promise<AgenticPrompt> {
    const record = toPromptRecord(prompt);
    await this.entityManager
      .createQueryBuilder()
      .update(AgenticPromptRecord)
      .set(record)
      .where('id = :id AND ownerParticipantId = :ownerParticipantId', {
        id: prompt.id,
        ownerParticipantId: prompt.ownerParticipantId,
      })
      .execute();
    return fromPromptRecord(record);
  }

  async deleteForOwner(
    promptId: string,
    ownerParticipantId: string,
  ): Promise<void> {
    await this.entityManager.delete(AgenticPromptRecord, {
      id: promptId,
      ownerParticipantId,
    });
  }
}

function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

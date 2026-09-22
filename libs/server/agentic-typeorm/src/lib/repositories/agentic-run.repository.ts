import {
  AgenticRun,
  AgenticRunRepository as AgenticRunRepositoryContract,
} from '@onivoro/isomorphic-agentic';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AgenticRunRecord } from '../entities/agentic-run.entity';
import { fromRunRecord, toRunRecord } from './agentic-mappers';

@Injectable()
export class AgenticRunRepository implements AgenticRunRepositoryContract {
  constructor(private readonly entityManager: EntityManager) {}

  async create(run: AgenticRun): Promise<AgenticRun> {
    const saved = await this.entityManager.save(
      AgenticRunRecord,
      toRunRecord(run),
    );
    return fromRunRecord(saved);
  }

  async update(run: AgenticRun): Promise<AgenticRun> {
    const saved = await this.entityManager.save(
      AgenticRunRecord,
      toRunRecord(run),
    );
    return fromRunRecord(saved);
  }

  async get(runId: string): Promise<AgenticRun | undefined> {
    const record = await this.entityManager.findOneBy(AgenticRunRecord, {
      id: runId,
    });
    return record ? fromRunRecord(record) : undefined;
  }
}

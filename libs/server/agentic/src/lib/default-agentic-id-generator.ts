import { randomUUID } from 'node:crypto';

export interface AgenticIdGenerator {
  createId(prefix?: string): string;
}

export class DefaultAgenticIdGenerator implements AgenticIdGenerator {
  createId(prefix?: string): string {
    return prefix ? `${prefix}_${randomUUID()}` : randomUUID();
  }
}

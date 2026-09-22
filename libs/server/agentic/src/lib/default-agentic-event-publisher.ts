import { AgenticEventPublisher } from '@onivoro/isomorphic-agentic';

export class NoopAgenticEventPublisher implements AgenticEventPublisher {
  async publish(): Promise<void> {
    return;
  }

  async publishMany(): Promise<void> {
    return;
  }
}

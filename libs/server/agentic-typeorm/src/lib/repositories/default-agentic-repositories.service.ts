import { AgenticRepositories } from '@onivoro/isomorphic-agentic';
import { Injectable } from '@nestjs/common';
import { AgenticConversationRepository } from './agentic-conversation.repository';
import { AgenticMessageRepository } from './agentic-message.repository';
import { AgenticPromptRepository } from './agentic-prompt.repository';
import { AgenticRunRepository } from './agentic-run.repository';
import { AgenticSummaryRepository } from './agentic-summary.repository';
import { AgenticUsageRepository } from './agentic-usage.repository';

@Injectable()
export class DefaultAgenticRepositories implements AgenticRepositories {
  constructor(
    readonly conversations: AgenticConversationRepository,
    readonly messages: AgenticMessageRepository,
    readonly prompts: AgenticPromptRepository,
    readonly runs: AgenticRunRepository,
    readonly usage: AgenticUsageRepository,
    readonly summaries: AgenticSummaryRepository,
  ) {}
}

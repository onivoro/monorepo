import { AgenticConversationRepository } from './agentic-conversation.repository';
import { AgenticMessageRepository } from './agentic-message.repository';
import { AgenticPromptRepository } from './agentic-prompt.repository';
import { AgenticRunRepository } from './agentic-run.repository';
import { AgenticSummaryRepository } from './agentic-summary.repository';
import { AgenticUsageRepository } from './agentic-usage.repository';
import { DefaultAgenticRepositories } from './default-agentic-repositories.service';

export const agenticRepositories = [
  AgenticConversationRepository,
  AgenticMessageRepository,
  AgenticPromptRepository,
  AgenticRunRepository,
  AgenticSummaryRepository,
  AgenticUsageRepository,
  DefaultAgenticRepositories,
];

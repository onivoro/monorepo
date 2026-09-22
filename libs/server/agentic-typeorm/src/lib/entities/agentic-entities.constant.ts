import { AgenticConversationSummaryRecord } from './agentic-conversation-summary.entity';
import { AgenticConversationRecord } from './agentic-conversation.entity';
import { AgenticMessageRecord } from './agentic-message.entity';
import { AgenticPromptRecord } from './agentic-prompt.entity';
import { AgenticRunRecord } from './agentic-run.entity';

export const agenticEntities = [
  AgenticConversationRecord,
  AgenticConversationSummaryRecord,
  AgenticMessageRecord,
  AgenticPromptRecord,
  AgenticRunRecord,
];

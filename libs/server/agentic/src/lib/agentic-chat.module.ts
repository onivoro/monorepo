import { DynamicModule, Module, Provider } from '@nestjs/common';
import { AgenticChatService } from './agentic-chat.service';
import { AgenticPromptLibraryService } from './agentic-prompt-library.service';
import {
  AGENTIC_CHAT_CONFIG,
  AGENTIC_EVENT_PUBLISHER,
  AGENTIC_ID_GENERATOR,
} from './agentic-chat.tokens';
import { AgenticChatConfig } from './agentic-chat-config';
import { NoopAgenticEventPublisher } from './default-agentic-event-publisher';
import { DefaultAgenticIdGenerator } from './default-agentic-id-generator';

export interface AgenticChatModuleConfig {
  config?: AgenticChatConfig;
  imports?: DynamicModule['imports'];
  providers?: Provider[];
  exports?: DynamicModule['exports'];
}

@Module({})
export class AgenticChatModule {
  static configure({
    config = {},
    imports = [],
    providers = [],
    exports = [],
  }: AgenticChatModuleConfig = {}): DynamicModule {
    return {
      module: AgenticChatModule,
      imports,
      providers: [
        { provide: AGENTIC_CHAT_CONFIG, useValue: config },
        { provide: AGENTIC_ID_GENERATOR, useClass: DefaultAgenticIdGenerator },
        {
          provide: AGENTIC_EVENT_PUBLISHER,
          useClass: NoopAgenticEventPublisher,
        },
        AgenticChatService,
        AgenticPromptLibraryService,
        ...providers,
      ],
      exports: [
        AgenticChatService,
        AgenticPromptLibraryService,
        AGENTIC_CHAT_CONFIG,
        AGENTIC_EVENT_PUBLISHER,
        AGENTIC_ID_GENERATOR,
        ...exports,
      ],
    };
  }
}

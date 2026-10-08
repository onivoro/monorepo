import { AgenticChatModule } from './agentic-chat.module';
import { AgenticChatService } from './agentic-chat.service';
import {
  AGENTIC_CHAT_CONFIG,
  AGENTIC_EVENT_PUBLISHER,
  AGENTIC_ID_GENERATOR,
  AGENTIC_MODEL_PROVIDER,
} from './agentic-chat.tokens';
import { AgenticPromptLibraryService } from './agentic-prompt-library.service';
import { NoopAgenticEventPublisher } from './default-agentic-event-publisher';
import { DefaultAgenticIdGenerator } from './default-agentic-id-generator';

describe(AgenticChatModule.name, () => {
  it('registers default providers and exports with no config', () => {
    const module = AgenticChatModule.configure();

    expect(module.module).toBe(AgenticChatModule);
    expect(module.imports).toEqual([]);
    expect(module.providers).toEqual([
      { provide: AGENTIC_CHAT_CONFIG, useValue: {} },
      { provide: AGENTIC_ID_GENERATOR, useClass: DefaultAgenticIdGenerator },
      { provide: AGENTIC_EVENT_PUBLISHER, useClass: NoopAgenticEventPublisher },
      AgenticChatService,
      AgenticPromptLibraryService,
    ]);
    expect(module.exports).toEqual([
      AgenticChatService,
      AgenticPromptLibraryService,
      AGENTIC_CHAT_CONFIG,
      AGENTIC_EVENT_PUBLISHER,
      AGENTIC_ID_GENERATOR,
    ]);
  });

  it('appends caller config, imports, providers and exports', () => {
    class ImportedModule {}
    const modelProvider = { provide: AGENTIC_MODEL_PROVIDER, useValue: {} };
    const config = { maxModelSteps: 2 };

    const module = AgenticChatModule.configure({
      config,
      imports: [ImportedModule],
      providers: [modelProvider],
      exports: [AGENTIC_MODEL_PROVIDER],
    });

    expect(module.imports).toEqual([ImportedModule]);
    expect(module.providers?.[0]).toEqual({
      provide: AGENTIC_CHAT_CONFIG,
      useValue: config,
    });
    expect(module.providers?.at(-1)).toBe(modelProvider);
    expect(module.exports?.at(-1)).toBe(AGENTIC_MODEL_PROVIDER);
  });
});

describe(DefaultAgenticIdGenerator.name, () => {
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

  it('prefixes ids when a prefix is given', () => {
    expect(new DefaultAgenticIdGenerator().createId('run')).toMatch(
      new RegExp(`^run_${uuid.source}$`),
    );
  });

  it('returns a bare uuid without a prefix', () => {
    const generator = new DefaultAgenticIdGenerator();
    const id = generator.createId();
    expect(id).toMatch(new RegExp(`^${uuid.source}$`));
    expect(generator.createId()).not.toBe(id);
  });
});

describe(NoopAgenticEventPublisher.name, () => {
  it('accepts events without doing anything', async () => {
    const publisher = new NoopAgenticEventPublisher();
    await expect(publisher.publish()).resolves.toBeUndefined();
    await expect(publisher.publishMany()).resolves.toBeUndefined();
  });
});

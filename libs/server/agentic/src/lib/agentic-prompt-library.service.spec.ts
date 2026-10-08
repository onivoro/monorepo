import {
  AgenticPrompt,
  AgenticPromptListOptions,
  AgenticPromptRepository,
  AgenticRepositories,
  AgenticMessage,
} from '@onivoro/isomorphic-agentic';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AgenticPromptLibraryService } from './agentic-prompt-library.service';

describe(AgenticPromptLibraryService.name, () => {
  it('creates prompts with extracted template parameters', async () => {
    const prompts = new InMemoryPromptRepository();
    const service = createService(prompts);

    const prompt = await service.createPrompt({
      prompt:
        'Summarize {{ patientName }} for {{visit_id}} and {{patientName}}.',
      title: '  Visit summary  ',
      user: { participantId: 'clinician-1' },
    });

    expect(prompt).toMatchObject({
      id: 'prompt-1',
      ownerParticipantId: 'clinician-1',
      title: 'Visit summary',
      parameters: [
        { label: 'Patient Name', name: 'patientName', required: true },
        { label: 'Visit id', name: 'visit_id', required: true },
      ],
    });
  });

  it('reparses parameters when prompt text changes', async () => {
    const prompts = new InMemoryPromptRepository();
    const service = createService(prompts);
    const prompt = await service.createPrompt({
      metadata: { pinned: true },
      prompt: 'Initial {{oldValue}}',
      title: 'Initial',
      user: { participantId: 'clinician-1' },
    });

    const updated = await service.updatePrompt({
      prompt: 'Updated {{newValue}}',
      promptId: prompt.id,
      title: 'Updated',
      user: { participantId: 'clinician-1' },
    });

    expect(updated).toMatchObject({
      metadata: { pinned: true },
      parameters: [{ name: 'newValue' }],
      prompt: 'Updated {{newValue}}',
      title: 'Updated',
    });
  });

  it('renders prompts with provided values', async () => {
    const prompts = new InMemoryPromptRepository();
    const service = createService(prompts);
    const prompt = await service.createPrompt({
      prompt: 'Draft a note for {{patientName}}.',
      title: 'Note',
      user: { participantId: 'clinician-1' },
    });

    await expect(
      service.renderPrompt({
        promptId: prompt.id,
        user: { participantId: 'clinician-1' },
        values: { patientName: 'Ada' },
      }),
    ).resolves.toMatchObject({ text: 'Draft a note for Ada.' });
  });

  it('rejects missing render values as bad requests', async () => {
    const prompts = new InMemoryPromptRepository();
    const service = createService(prompts);
    const prompt = await service.createPrompt({
      prompt: 'Draft a note for {{patientName}}.',
      title: 'Note',
      user: { participantId: 'clinician-1' },
    });

    await expect(
      service.renderPrompt({
        promptId: prompt.id,
        user: { participantId: 'clinician-1' },
        values: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not expose prompts across owners', async () => {
    const prompts = new InMemoryPromptRepository();
    const service = createService(prompts);
    const prompt = await service.createPrompt({
      prompt: 'Private prompt',
      title: 'Private',
      user: { participantId: 'clinician-1' },
    });

    await expect(
      service.renderPrompt({
        promptId: prompt.id,
        user: { participantId: 'clinician-2' },
        values: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe(`${AgenticPromptLibraryService.name} validation and ownership`, () => {
  const owner = { participantId: 'clinician-1' };

  async function seeded() {
    const prompts = new InMemoryPromptRepository();
    const service = createService(prompts);
    const prompt = await service.createPrompt({
      id: 'fixed-id',
      metadata: { pinned: true },
      prompt: 'Hello {{name}}',
      title: 'Greeting',
      user: owner,
    });
    return { prompts, prompt, service };
  }

  it('uses a caller-provided id', async () => {
    const { prompt } = await seeded();
    expect(prompt.id).toBe('fixed-id');
  });

  it('lists prompts for the requesting owner with paging options', async () => {
    const { prompts, service } = await seeded();
    const list = jest.spyOn(prompts, 'listForOwner');

    await expect(
      service.listPrompts({ user: owner, limit: 5, search: 'greet' }),
    ).resolves.toHaveLength(1);
    expect(list).toHaveBeenCalledWith({
      limit: 5,
      ownerParticipantId: 'clinician-1',
      search: 'greet',
    });
    await expect(
      service.listPrompts({ user: { participantId: 'someone-else' } }),
    ).resolves.toEqual([]);
  });

  it.each([
    [{ title: '   ', prompt: 'x' }, 'Prompt title is required.'],
    [{ title: 'x', prompt: '  ' }, 'Prompt text is required.'],
    [
      { title: 'x', prompt: 'Hi {{name}' },
      'Prompt template has unbalanced parameter delimiters.',
    ],
    [
      { title: 'x', prompt: 'Hi {{ }}' },
      'Prompt parameter names cannot be empty.',
    ],
  ])('rejects invalid prompt input %j', async (input, message) => {
    const service = createService(new InMemoryPromptRepository());

    const result = service.createPrompt({ ...input, user: owner });

    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toThrow(message);
  });

  it('keeps existing fields when an update omits them', async () => {
    const { prompt, service } = await seeded();

    await expect(
      service.updatePrompt({ promptId: prompt.id, user: owner }),
    ).resolves.toMatchObject({
      title: 'Greeting',
      prompt: 'Hello {{name}}',
      metadata: { pinned: true },
      parameters: [{ name: 'name' }],
    });
  });

  it('replaces metadata and validates updated text', async () => {
    const { prompt, service } = await seeded();

    await expect(
      service.updatePrompt({
        promptId: prompt.id,
        metadata: { pinned: false },
        user: owner,
      }),
    ).resolves.toMatchObject({ metadata: { pinned: false } });
    await expect(
      service.updatePrompt({ promptId: prompt.id, title: ' ', user: owner }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to update prompts owned by someone else', async () => {
    const { prompt, service } = await seeded();

    await expect(
      service.updatePrompt({
        promptId: prompt.id,
        title: 'Hijack',
        user: { participantId: 'clinician-2' },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes owned prompts and rejects missing ones', async () => {
    const { prompts, prompt, service } = await seeded();
    const remove = jest.spyOn(prompts, 'deleteForOwner');

    await service.deletePrompt(prompt.id, owner);

    expect(remove).toHaveBeenCalledWith('fixed-id', 'clinician-1');
    await expect(service.deletePrompt(prompt.id, owner)).rejects.toThrow(
      'Prompt not found.',
    );
  });

  it('reports a missing prompt repository', async () => {
    const service = new AgenticPromptLibraryService(
      { messages: new EmptyMessageRepository() },
      { createId: () => 'id' },
    );

    expect(() => service.listPrompts({ user: owner })).toThrow(
      'Agentic prompt repository is not configured.',
    );
  });
});

function createService(prompts: AgenticPromptRepository) {
  let id = 1;
  return new AgenticPromptLibraryService(
    {
      messages: new EmptyMessageRepository(),
      prompts,
    } satisfies AgenticRepositories,
    { createId: (prefix) => `${prefix}-${id++}` },
  );
}

class InMemoryPromptRepository implements AgenticPromptRepository {
  private readonly prompts = new Map<string, AgenticPrompt>();

  async create(prompt: AgenticPrompt): Promise<AgenticPrompt> {
    this.prompts.set(prompt.id, prompt);
    return prompt;
  }

  async getForOwner(
    promptId: string,
    ownerParticipantId: string,
  ): Promise<AgenticPrompt | undefined> {
    const prompt = this.prompts.get(promptId);
    if (prompt?.ownerParticipantId !== ownerParticipantId) return undefined;
    return prompt;
  }

  async listForOwner(
    options: AgenticPromptListOptions,
  ): Promise<AgenticPrompt[]> {
    return Array.from(this.prompts.values()).filter(
      (prompt) => prompt.ownerParticipantId === options.ownerParticipantId,
    );
  }

  async updateForOwner(prompt: AgenticPrompt): Promise<AgenticPrompt> {
    this.prompts.set(prompt.id, prompt);
    return prompt;
  }

  async deleteForOwner(
    promptId: string,
    ownerParticipantId: string,
  ): Promise<void> {
    const prompt = await this.getForOwner(promptId, ownerParticipantId);
    if (prompt) this.prompts.delete(promptId);
  }
}

class EmptyMessageRepository {
  async create(message: AgenticMessage): Promise<AgenticMessage> {
    return message;
  }

  async update(message: AgenticMessage): Promise<AgenticMessage> {
    return message;
  }

  async get(): Promise<AgenticMessage | undefined> {
    return undefined;
  }

  async listByConversationId(): Promise<AgenticMessage[]> {
    return [];
  }

  async upsertPart(): Promise<void> {}

  async appendPartDelta(): Promise<void> {}
}

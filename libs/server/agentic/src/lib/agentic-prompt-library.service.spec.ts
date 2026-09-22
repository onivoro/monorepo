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

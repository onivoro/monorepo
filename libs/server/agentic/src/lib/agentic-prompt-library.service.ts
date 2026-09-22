import {
  AgenticPrompt,
  AgenticRepositories,
  extractAgenticPromptParameters,
  JsonObject,
  renderAgenticPrompt,
} from '@onivoro/isomorphic-agentic';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AGENTIC_ID_GENERATOR,
  AGENTIC_REPOSITORIES,
} from './agentic-chat.tokens';
import { AgenticIdGenerator } from './default-agentic-id-generator';

export interface AgenticPromptOwnerContext {
  participantId: string;
}

export interface CreateAgenticPromptInput {
  id?: string;
  metadata?: JsonObject;
  prompt: string;
  title: string;
  user: AgenticPromptOwnerContext;
}

export interface UpdateAgenticPromptInput {
  metadata?: JsonObject;
  prompt?: string;
  promptId: string;
  title?: string;
  user: AgenticPromptOwnerContext;
}

@Injectable()
export class AgenticPromptLibraryService {
  constructor(
    @Inject(AGENTIC_REPOSITORIES)
    private readonly repositories: AgenticRepositories,
    @Inject(AGENTIC_ID_GENERATOR)
    private readonly idGenerator: AgenticIdGenerator,
  ) {}

  listPrompts(input: {
    limit?: number;
    search?: string;
    user: AgenticPromptOwnerContext;
  }): Promise<AgenticPrompt[]> {
    return this.prompts.listForOwner({
      limit: input.limit,
      ownerParticipantId: input.user.participantId,
      search: input.search,
    });
  }

  async createPrompt(input: CreateAgenticPromptInput): Promise<AgenticPrompt> {
    const now = new Date().toISOString();
    const title = cleanTitle(input.title);
    const prompt = cleanPrompt(input.prompt);
    const parameters = parseParameters(prompt);

    return this.prompts.create({
      id: input.id ?? this.idGenerator.createId('prompt'),
      ownerParticipantId: input.user.participantId,
      title,
      prompt,
      parameters,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    });
  }

  async updatePrompt(input: UpdateAgenticPromptInput): Promise<AgenticPrompt> {
    const existing = await this.getOwnedPrompt(input.promptId, input.user);
    const prompt =
      input.prompt === undefined ? existing.prompt : cleanPrompt(input.prompt);

    return this.prompts.updateForOwner({
      ...existing,
      title:
        input.title === undefined ? existing.title : cleanTitle(input.title),
      prompt,
      parameters: parseParameters(prompt),
      metadata:
        input.metadata === undefined ? existing.metadata : input.metadata,
      updatedAt: new Date().toISOString(),
    });
  }

  async deletePrompt(
    promptId: string,
    user: AgenticPromptOwnerContext,
  ): Promise<void> {
    await this.getOwnedPrompt(promptId, user);
    await this.prompts.deleteForOwner(promptId, user.participantId);
  }

  async renderPrompt(input: {
    promptId: string;
    user: AgenticPromptOwnerContext;
    values: Record<string, string>;
  }): Promise<{ prompt: AgenticPrompt; text: string }> {
    const prompt = await this.getOwnedPrompt(input.promptId, input.user);
    try {
      return {
        prompt,
        text: renderAgenticPrompt(prompt, input.values),
      };
    } catch (error) {
      throw new BadRequestException(errorMessage(error));
    }
  }

  private async getOwnedPrompt(
    promptId: string,
    user: AgenticPromptOwnerContext,
  ): Promise<AgenticPrompt> {
    const prompt = await this.prompts.getForOwner(promptId, user.participantId);
    if (!prompt) throw new NotFoundException('Prompt not found.');
    return prompt;
  }

  private get prompts() {
    if (!this.repositories.prompts) {
      throw new Error('Agentic prompt repository is not configured.');
    }
    return this.repositories.prompts;
  }
}

function cleanTitle(title: string): string {
  const value = title.trim();
  if (!value) throw new BadRequestException('Prompt title is required.');
  return value;
}

function cleanPrompt(prompt: string): string {
  const value = prompt.trim();
  if (!value) throw new BadRequestException('Prompt text is required.');
  return value;
}

function parseParameters(prompt: string) {
  try {
    return extractAgenticPromptParameters(prompt);
  } catch (error) {
    throw new BadRequestException(errorMessage(error));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

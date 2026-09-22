import type { AgenticPrompt, JsonObject } from '@onivoro/isomorphic-agentic';
import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import {
  CreateAgenticPromptDto,
  RenderAgenticPromptDto,
  UpdateAgenticPromptDto,
} from './agentic-chat.dtos';

export interface AgenticPromptLibraryControllerService<TUser> {
  listPrompts(input: {
    user: TUser;
    limit?: number;
    search?: string;
  }): Promise<AgenticPrompt[]>;
  createPrompt(input: {
    id?: string;
    metadata?: JsonObject;
    prompt: string;
    title: string;
    user: TUser;
  }): Promise<AgenticPrompt>;
  updatePrompt(input: {
    metadata?: JsonObject;
    prompt?: string;
    promptId: string;
    title?: string;
    user: TUser;
  }): Promise<AgenticPrompt>;
  deletePrompt(promptId: string, user: TUser): Promise<void>;
  renderPrompt(input: {
    promptId: string;
    user: TUser;
    values: Record<string, string>;
  }): Promise<{ prompt: AgenticPrompt; text: string }>;
}

export abstract class AgenticPromptLibraryController<
  TUser,
  TRequest = unknown,
> {
  protected constructor(
    private readonly promptLibraryService: AgenticPromptLibraryControllerService<TUser>,
  ) {}

  protected abstract getPromptLibraryUser(request: TRequest): TUser;

  @Get('prompts')
  listPrompts(
    @Req() request: TRequest,
    @Query('q') search?: string,
    @Query('limit') limit?: string,
  ): Promise<AgenticPrompt[]> {
    return this.promptLibraryService.listPrompts({
      user: this.getPromptLibraryUser(request),
      limit: this.parsePromptLibraryLimit(limit),
      search,
    });
  }

  @Post('prompts')
  @ApiBody({ schema: { type: 'object', required: ['title', 'prompt'] } })
  createPrompt(
    @Req() request: TRequest,
    @Body() body: CreateAgenticPromptDto,
  ): Promise<AgenticPrompt> {
    return this.promptLibraryService.createPrompt({
      id: body.id,
      metadata: body.metadata,
      prompt: body.prompt,
      title: body.title,
      user: this.getPromptLibraryUser(request),
    });
  }

  @Post('prompts/:promptId')
  @HttpCode(200)
  @ApiBody({ schema: { type: 'object' } })
  updatePrompt(
    @Req() request: TRequest,
    @Param('promptId') promptId: string,
    @Body() body: UpdateAgenticPromptDto,
  ): Promise<AgenticPrompt> {
    return this.promptLibraryService.updatePrompt({
      metadata: body.metadata,
      prompt: body.prompt,
      promptId,
      title: body.title,
      user: this.getPromptLibraryUser(request),
    });
  }

  @Delete('prompts/:promptId')
  @HttpCode(204)
  deletePrompt(
    @Req() request: TRequest,
    @Param('promptId') promptId: string,
  ): Promise<void> {
    return this.promptLibraryService.deletePrompt(
      promptId,
      this.getPromptLibraryUser(request),
    );
  }

  @Post('prompts/:promptId/render')
  @ApiBody({ schema: { type: 'object', required: ['values'] } })
  renderPrompt(
    @Req() request: TRequest,
    @Param('promptId') promptId: string,
    @Body() body: RenderAgenticPromptDto,
  ): Promise<{ prompt: AgenticPrompt; text: string }> {
    return this.promptLibraryService.renderPrompt({
      promptId,
      user: this.getPromptLibraryUser(request),
      values: body.values,
    });
  }

  protected parsePromptLibraryLimit(
    value: string | undefined,
  ): number | undefined {
    return parsePromptLibraryLimit(value);
  }
}

function parsePromptLibraryLimit(
  value: string | undefined,
): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

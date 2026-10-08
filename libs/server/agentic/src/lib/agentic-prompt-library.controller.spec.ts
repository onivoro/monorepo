import { AgenticPrompt } from '@onivoro/isomorphic-agentic';
import {
  AgenticPromptLibraryController,
  AgenticPromptLibraryControllerService,
} from './agentic-prompt-library.controller';

interface TestUser {
  id: string;
}

interface TestRequest {
  user: TestUser;
}

class TestPromptLibraryController extends AgenticPromptLibraryController<
  TestUser,
  TestRequest
> {
  constructor(service: AgenticPromptLibraryControllerService<TestUser>) {
    super(service);
  }

  protected getPromptLibraryUser(request: TestRequest): TestUser {
    return request.user;
  }
}

describe(AgenticPromptLibraryController.name, () => {
  const request: TestRequest = { user: { id: 'user-1' } };
  const prompt = { id: 'p-1' } as AgenticPrompt;

  function setup() {
    const service = {
      listPrompts: jest.fn(async () => [prompt]),
      createPrompt: jest.fn(async () => prompt),
      updatePrompt: jest.fn(async () => prompt),
      deletePrompt: jest.fn(async () => undefined),
      renderPrompt: jest.fn(async () => ({ prompt, text: 'rendered' })),
    };
    return { controller: new TestPromptLibraryController(service), service };
  }

  it('lists prompts for the request user with a parsed limit', async () => {
    const { controller, service } = setup();

    await expect(controller.listPrompts(request, 'q', '25')).resolves.toEqual([
      prompt,
    ]);
    expect(service.listPrompts).toHaveBeenCalledWith({
      user: request.user,
      limit: 25,
      search: 'q',
    });
  });

  it.each([
    [undefined, undefined],
    ['', undefined],
    ['abc', undefined],
    ['7items', 7],
  ])('parses limit %p as %p', async (limit, expected) => {
    const { controller, service } = setup();

    await controller.listPrompts(request, undefined, limit);

    expect(service.listPrompts).toHaveBeenCalledWith(
      expect.objectContaining({ limit: expected }),
    );
  });

  it('creates prompts from the request body', async () => {
    const { controller, service } = setup();

    await controller.createPrompt(request, {
      id: 'p-1',
      title: 'T',
      prompt: 'P',
      metadata: { a: 1 },
    });

    expect(service.createPrompt).toHaveBeenCalledWith({
      id: 'p-1',
      title: 'T',
      prompt: 'P',
      metadata: { a: 1 },
      user: request.user,
    });
  });

  it('updates prompts by id', async () => {
    const { controller, service } = setup();

    await controller.updatePrompt(request, 'p-1', { title: 'New' });

    expect(service.updatePrompt).toHaveBeenCalledWith({
      metadata: undefined,
      prompt: undefined,
      promptId: 'p-1',
      title: 'New',
      user: request.user,
    });
  });

  it('deletes prompts by id', async () => {
    const { controller, service } = setup();

    await controller.deletePrompt(request, 'p-1');

    expect(service.deletePrompt).toHaveBeenCalledWith('p-1', request.user);
  });

  it('renders prompts with the supplied values', async () => {
    const { controller, service } = setup();

    await expect(
      controller.renderPrompt(request, 'p-1', { values: { name: 'Ada' } }),
    ).resolves.toEqual({ prompt, text: 'rendered' });
    expect(service.renderPrompt).toHaveBeenCalledWith({
      promptId: 'p-1',
      user: request.user,
      values: { name: 'Ada' },
    });
  });
});

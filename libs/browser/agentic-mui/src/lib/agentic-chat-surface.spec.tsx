import type {
  AgenticMessage,
  AgenticPart,
  AgenticPrompt,
} from '@onivoro/isomorphic-agentic';
import type { AgenticPromptLibraryClient } from '@onivoro/browser-agentic';
import {
  act,
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  AgenticChatSurface,
  AgenticChatSurfaceProps,
} from './agentic-chat-surface';

// MUI renders are slow under parallel CI load; widen the default timeouts.
configure({ asyncUtilTimeout: 5000 });
jest.setTimeout(20000);

const message = (
  overrides: Partial<AgenticMessage> & Pick<AgenticMessage, 'id'>,
): AgenticMessage => ({
  conversationId: 'c1',
  createdAt: '',
  parts: [],
  role: 'assistant',
  status: 'complete',
  updatedAt: '',
  ...overrides,
});

const prompt = (
  overrides: Partial<AgenticPrompt> & Pick<AgenticPrompt, 'id' | 'title'>,
): AgenticPrompt => ({
  createdAt: '',
  ownerParticipantId: 'me',
  parameters: [],
  prompt: `${overrides.title} body`,
  updatedAt: '',
  ...overrides,
});

const renderSurface = (overrides: Partial<AgenticChatSurfaceProps> = {}) => {
  const onSend = jest.fn().mockResolvedValue(undefined);
  const props: AgenticChatSurfaceProps = {
    conversationId: 'conversation-1',
    isConnected: true,
    isLoading: false,
    isSending: false,
    messages: [],
    onSend,
    ...overrides,
  };
  const view = render(<AgenticChatSurface {...props} />);
  return {
    ...view,
    onSend: props.onSend as jest.Mock,
    rerenderWith: (next: Partial<AgenticChatSurfaceProps>) =>
      view.rerender(<AgenticChatSurface {...props} {...next} />),
  };
};

const composer = () =>
  screen.getByPlaceholderText('Message iGENTiC') as HTMLTextAreaElement;

const sendButton = () =>
  screen.getByLabelText('Send message') as HTMLButtonElement;

/** Matches a payload block, whose whitespace the default matcher would collapse. */
const pre = (text: string) =>
  Array.from(document.querySelectorAll('pre')).find(
    (element) => element.textContent === text,
  ) ?? null;

const button = (name: string | RegExp) =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

describe('AgenticChatSurface', () => {
  describe('header', () => {
    it('shows the default heading, the conversation id and a connected chip', () => {
      renderSurface();

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        'iGENTiC',
      );
      expect(screen.queryByText('conversation-1')).not.toBeNull();
      expect(screen.queryByText('Connected')).not.toBeNull();
      expect(screen.queryByLabelText('Open prompt library')).toBeNull();
    });

    it('shows a custom heading and subheading and a reconnecting chip', () => {
      renderSurface({
        heading: 'Helper',
        isConnected: false,
        subheading: <span>custom sub</span>,
      });

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        'Helper',
      );
      expect(screen.queryByText('custom sub')).not.toBeNull();
      expect(screen.queryByText('conversation-1')).toBeNull();
      expect(screen.queryByText('Reconnecting')).not.toBeNull();
    });

    it('shows an error alert', () => {
      renderSurface({ error: 'stream dropped' });

      expect(screen.getByRole('alert').textContent).toContain('stream dropped');
    });
  });

  describe('empty states', () => {
    it('shows the loading state while there are no messages yet', () => {
      renderSurface({ isLoading: true });

      expect(screen.queryByText('Loading conversation...')).not.toBeNull();
      expect(
        screen.queryByText('Start a conversation with iGENTiC.'),
      ).toBeNull();
    });

    it('invites the user to start a conversation', () => {
      renderSurface();

      expect(
        screen.queryByText('Start a conversation with iGENTiC.'),
      ).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    });
  });

  describe('starter actions', () => {
    const starterActions = [
      {
        inputs: [
          { label: 'Ticket', name: 'ticket', required: true },
          { defaultValue: 'high', label: 'Priority', name: 'priority' },
          { label: 'Notes', name: 'notes' },
        ],
        label: 'Triage',
        metadata: { workflowLabel: 'triage' },
        prompt: 'Triage the ticket',
      },
      { label: 'Summarize', prompt: 'Summarize everything' },
    ];

    it('holds back an action until its required inputs are filled', () => {
      renderSurface({ starterActions });

      const [triage, summarize] = screen.getAllByRole('button', {
        name: 'Start',
      }) as HTMLButtonElement[];
      expect(triage.disabled).toBe(true);
      expect(summarize.disabled).toBe(false);

      fireEvent.change(screen.getByLabelText(/^Ticket/), {
        target: { value: '   ' },
      });
      expect(triage.disabled).toBe(true);

      fireEvent.change(screen.getByLabelText(/^Ticket/), {
        target: { value: 'T-9' },
      });
      expect(triage.disabled).toBe(false);
    });

    it('sends the prompt with populated inputs and merged metadata', async () => {
      const { onSend } = renderSurface({
        resourceContext: {
          label: 'Ticket 9',
          resourceId: 9,
          resourceType: 'ticket',
        },
        starterActions,
      });

      expect(
        (screen.getByLabelText(/^Priority/) as HTMLInputElement).value,
      ).toBe('high');
      fireEvent.change(screen.getByLabelText(/^Ticket/), {
        target: { value: ' T-9 ' },
      });

      await act(async () => {
        fireEvent.click(screen.getAllByRole('button', { name: 'Start' })[0]);
      });

      expect(onSend).toHaveBeenCalledWith(
        'Triage the ticket\n\nWorkflow inputs:\n- ticket: T-9\n- priority: high',
        {
          identifiers: {},
          resourceId: 9,
          resourceLabel: 'Ticket 9',
          resourceType: 'ticket',
          workflowInputs: { notes: '', priority: 'high', ticket: 'T-9' },
          workflowLabel: 'triage',
        },
      );
    });

    it('sends the bare prompt when the action has no inputs', async () => {
      const { onSend } = renderSurface({ starterActions });

      await act(async () => {
        fireEvent.click(screen.getAllByRole('button', { name: 'Start' })[1]);
      });

      expect(onSend).toHaveBeenCalledWith('Summarize everything', {
        workflowInputs: {},
      });
    });

    it('disables every action while sending', () => {
      renderSurface({ isSending: true, starterActions });

      for (const start of screen.getAllByRole('button', { name: 'Start' })) {
        expect((start as HTMLButtonElement).disabled).toBe(true);
      }
    });
  });

  describe('composer', () => {
    it('only enables send once there is non-blank text', () => {
      renderSurface();

      expect(sendButton().disabled).toBe(true);
      fireEvent.change(composer(), { target: { value: '   ' } });
      expect(sendButton().disabled).toBe(true);
      fireEvent.change(composer(), { target: { value: 'hi' } });
      expect(sendButton().disabled).toBe(false);
    });

    it('sends the trimmed draft on Enter with the resource metadata and clears it', async () => {
      const { onSend } = renderSurface({
        resourceContext: {
          identifiers: { mrn: 'A1' },
          resourceId: '7',
          resourceType: 'patient',
        },
      });

      fireEvent.change(composer(), { target: { value: '  hello  ' } });
      await act(async () => {
        fireEvent.keyDown(composer(), { key: 'Enter' });
      });

      expect(onSend).toHaveBeenCalledWith('hello', {
        identifiers: { mrn: 'A1' },
        mrn: 'A1',
        resourceId: '7',
        resourceType: 'patient',
      });
      expect(composer().value).toBe('');
    });

    it('does not send on Shift+Enter or other keys', () => {
      const { onSend } = renderSurface();

      fireEvent.change(composer(), { target: { value: 'hello' } });
      fireEvent.keyDown(composer(), { key: 'Enter', shiftKey: true });
      fireEvent.keyDown(composer(), { key: 'a' });

      expect(onSend).not.toHaveBeenCalled();
    });

    it('does not send blank text on Enter', () => {
      const { onSend } = renderSurface();

      fireEvent.change(composer(), { target: { value: '   ' } });
      fireEvent.keyDown(composer(), { key: 'Enter' });

      expect(onSend).not.toHaveBeenCalled();
    });

    it('sends on form submit', async () => {
      const { onSend } = renderSurface();

      fireEvent.change(composer(), { target: { value: 'submit me' } });
      await act(async () => {
        fireEvent.click(sendButton());
      });

      expect(onSend).toHaveBeenCalledWith('submit me', {});
    });

    it('locks the composer while sending', () => {
      const { onSend } = renderSurface({ isSending: true });

      expect(composer().disabled).toBe(true);
      expect(sendButton().disabled).toBe(true);
      fireEvent.keyDown(composer(), { key: 'Enter' });
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe('messages', () => {
    it('labels each role and hides tool messages', () => {
      renderSurface({
        messages: [
          message({
            id: 'u',
            parts: [{ id: 'p1', text: 'question', type: 'text' }],
            role: 'user',
          }),
          message({
            id: 'a',
            parts: [{ id: 'p2', text: 'answer', type: 'text' }],
          }),
          message({
            id: 's',
            parts: [{ id: 'p3', text: 'recap', type: 'summary' }],
            role: 'summary',
          }),
          message({
            id: 'y',
            parts: [{ id: 'p4', text: 'rules', type: 'text' }],
            role: 'system',
          }),
          message({
            id: 't',
            parts: [
              {
                id: 'p5',
                name: 'lookup',
                result: 'secret tool output',
                toolCallId: 'x',
                type: 'tool-result',
              },
            ],
            role: 'tool',
          }),
        ],
      });

      for (const label of ['You', 'iGENTiC', 'Summary', 'System']) {
        expect(screen.queryAllByText(label).length).toBeGreaterThan(0);
      }
      for (const text of ['question', 'answer', 'recap', 'rules']) {
        expect(screen.queryByText(text)).not.toBeNull();
      }
      expect(screen.queryByText('secret tool output')).toBeNull();
      expect(
        screen.queryByText('Start a conversation with iGENTiC.'),
      ).toBeNull();
    });

    it('shows a formatted timestamp only when the date is valid', () => {
      const createdAt = '2024-01-02T03:04:05.000Z';
      const expected = new Intl.DateTimeFormat(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(createdAt));

      renderSurface({
        messages: [
          message({
            createdAt,
            id: 'a',
            parts: [{ id: 'p', text: 'x', type: 'text' }],
          }),
          message({
            createdAt: 'not a date',
            id: 'b',
            parts: [{ id: 'q', text: 'y', type: 'text' }],
          }),
        ],
      });

      expect(screen.queryAllByText(expected)).toHaveLength(1);
      expect(screen.queryByText('not a date')).toBeNull();
    });

    it('shows the message status', () => {
      renderSurface({
        messages: [
          message({
            id: 'a',
            parts: [{ id: 'p', text: 'x', type: 'text' }],
            status: 'error',
          }),
        ],
      });

      expect(screen.queryByText('error')).not.toBeNull();
    });

    it('shows thinking for pending and streaming messages without content', () => {
      renderSurface({
        messages: [
          message({ id: 'a', status: 'pending' }),
          message({ id: 'b', status: 'streaming' }),
        ],
      });

      expect(screen.queryAllByText('Thinking...')).toHaveLength(2);
    });

    it('says there is no content for a finished empty message', () => {
      renderSurface({ messages: [message({ id: 'a' })] });

      expect(screen.queryByText('No response content.')).not.toBeNull();
    });

    it('renders reasoning, error, file and other parts', () => {
      const parts: AgenticPart[] = [
        { id: 'r', text: 'mulling it over', type: 'reasoning' },
        { id: 'e', message: 'model failed', type: 'error' },
        { id: 'f', name: 'report.pdf', type: 'file' },
        { action: 'deploy', id: 'ap', type: 'approval' },
      ];
      renderSurface({
        messages: [
          message({ id: 'a', parts }),
          message({
            id: 'u',
            parts: [{ id: 'r2', text: 'user reasoning', type: 'reasoning' }],
            role: 'user',
          }),
        ],
      });

      expect(screen.queryByText('mulling it over')).not.toBeNull();
      expect(screen.queryByText('user reasoning')).not.toBeNull();
      expect(screen.getByRole('alert').textContent).toContain('model failed');
      expect(screen.queryByText('report.pdf')).not.toBeNull();
      expect(screen.queryByText(/"action": "deploy"/)).not.toBeNull();
    });

    it('renders assistant JSON text as a formatted payload block', () => {
      renderSurface({
        messages: [
          message({
            id: 'a',
            parts: [{ id: 'p', text: ' {"a":1} ', type: 'text' }],
          }),
          message({
            id: 'b',
            parts: [{ id: 'q', text: '{not json', type: 'text' }],
          }),
        ],
      });

      expect(screen.queryByText('JSON')).not.toBeNull();
      expect(pre('{\n  "a": 1\n}')).not.toBeNull();
      // unparseable text falls back to markdown
      expect(screen.queryByText('{not json')).not.toBeNull();
    });

    it('renders user JSON text verbatim rather than as a payload', () => {
      renderSurface({
        messages: [
          message({
            id: 'u',
            parts: [{ id: 'p', text: '{"a":1}', type: 'text' }],
            role: 'user',
          }),
        ],
      });

      expect(screen.queryByText('JSON')).toBeNull();
      expect(screen.queryByText('{"a":1}')).not.toBeNull();
    });
  });

  describe('tool calls', () => {
    const toolMessages = (): AgenticMessage[] => [
      message({
        id: 'a',
        parts: [
          {
            id: 'c1',
            input: { query: 'cats' },
            name: 'search',
            status: 'complete',
            toolCallId: 'call-1',
            type: 'tool-call',
          },
          {
            id: 'c2',
            inputText: '{"id":',
            name: 'fetch',
            toolCallId: 'call-2',
            type: 'tool-call',
          },
          {
            id: 'c3',
            name: 'broken',
            toolCallId: 'call-3',
            type: 'tool-call',
          },
        ],
      }),
      message({
        id: 't',
        parts: [
          {
            id: 'r1',
            name: 'search',
            result: [1, 2, 3],
            toolCallId: 'call-1',
            type: 'tool-result',
          },
          {
            id: 'r3',
            isError: true,
            name: 'broken',
            result: undefined,
            resultText: 'kaboom',
            toolCallId: 'call-3',
            type: 'tool-result',
          },
        ],
        role: 'tool',
      }),
    ];

    it('collapses tool calls behind a toggle and pairs them with their results', () => {
      renderSurface({ messages: toolMessages() });

      // only tool parts, so neither the thinking nor empty placeholder shows
      expect(screen.queryByText('No response content.')).toBeNull();
      expect(screen.queryByText('search')).toBeNull();

      fireEvent.click(screen.getByText(/Show tool calls/));

      expect(screen.queryByText(/Hide tool calls/)).not.toBeNull();
      expect(screen.queryByText('search')).not.toBeNull();
      expect(screen.queryByText('3 records')).not.toBeNull();
      expect(screen.queryAllByText('kaboom').length).toBeGreaterThan(0);
      // the call without a result keeps its own pending status
      expect(screen.queryAllByText('pending').length).toBeGreaterThan(0);
      expect(screen.queryAllByText('complete').length).toBeGreaterThan(0);

      fireEvent.click(screen.getByText(/Hide tool calls/));
      expect(screen.queryByText(/Show tool calls/)).not.toBeNull();
    });

    it('shows arguments and results when a tool is expanded and copies them', async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      renderSurface({ messages: toolMessages() });
      fireEvent.click(screen.getByText(/Show tool calls/));
      fireEvent.click(screen.getByText('search'));

      expect(screen.queryAllByText('Arguments').length).toBeGreaterThan(0);
      expect(pre('{\n  "query": "cats"\n}')).not.toBeNull();
      expect(screen.queryAllByText('Result').length).toBeGreaterThan(0);
      expect(screen.queryAllByText('Error').length).toBeGreaterThan(0);
      // partial argument text that does not parse is shown as typed
      expect(pre('{"id":')).not.toBeNull();

      const argumentsBlock = pre('{\n  "query": "cats"\n}')
        ?.parentElement as HTMLElement;
      fireEvent.click(within(argumentsBlock).getByLabelText('Copy'));

      expect(writeText).toHaveBeenCalledWith('{\n  "query": "cats"\n}');
    });

    it('renders standalone tool results with their own status', () => {
      renderSurface({
        messages: [
          message({
            id: 'a',
            parts: [
              {
                id: 'r1',
                name: 'ok-tool',
                result: { a: 1, b: 2 },
                toolCallId: 'x',
                type: 'tool-result',
              },
              {
                id: 'r2',
                isError: true,
                name: 'bad-tool',
                result: '   ',
                toolCallId: 'y',
                type: 'tool-result',
              },
              {
                id: 'r3',
                name: 'text-tool',
                result: 'x'.repeat(100),
                status: 'running',
                toolCallId: 'z',
                type: 'tool-result',
              },
            ],
          }),
        ],
      });

      fireEvent.click(screen.getByText(/Show tool calls \(3\)/));

      expect(screen.queryByText('2 fields')).not.toBeNull();
      expect(screen.queryByText('x'.repeat(80))).not.toBeNull();
      expect(screen.queryByText('running')).not.toBeNull();
      expect(screen.queryAllByText('error').length).toBeGreaterThan(0);
    });
  });

  describe('scrolling', () => {
    let rafSpy: jest.SpyInstance;

    beforeEach(() => {
      rafSpy = jest
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback) => {
          callback(0);
          return 0;
        });
    });

    afterEach(() => rafSpy.mockRestore());

    const scroller = () =>
      screen.getByText('first').closest('.MuiPaper-root')
        ?.parentElement as HTMLElement;

    it('sticks to the bottom until the user scrolls away, then only follows their own messages', () => {
      const first = message({
        id: 'a',
        parts: [{ id: 'p', text: 'first', type: 'text' }],
      });
      const { rerenderWith } = renderSurface({ messages: [first] });

      const element = scroller();
      Object.defineProperty(element, 'scrollHeight', {
        configurable: true,
        value: 1000,
      });
      Object.defineProperty(element, 'clientHeight', {
        configurable: true,
        value: 100,
      });
      expect(rafSpy).toHaveBeenCalledTimes(1);

      // scrolled well away from the bottom
      element.scrollTop = 0;
      fireEvent.scroll(element);

      const reply = message({
        id: 'b',
        parts: [{ id: 'q', text: 'reply', type: 'text' }],
      });
      rerenderWith({ messages: [first, reply] });
      expect(rafSpy).toHaveBeenCalledTimes(1);

      const mine = message({
        id: 'c',
        parts: [{ id: 'r', text: 'mine', type: 'text' }],
        role: 'user',
      });
      rerenderWith({ messages: [first, reply, mine] });
      expect(rafSpy).toHaveBeenCalledTimes(2);
      expect(element.scrollTop).toBe(1000);
    });

    it('scrolls to the bottom when the conversation changes', () => {
      const first = message({
        id: 'a',
        parts: [{ id: 'p', text: 'first', type: 'text' }],
      });
      const { rerenderWith } = renderSurface({ messages: [first] });

      const element = scroller();
      Object.defineProperty(element, 'scrollHeight', {
        configurable: true,
        value: 1000,
      });
      Object.defineProperty(element, 'clientHeight', {
        configurable: true,
        value: 100,
      });
      element.scrollTop = 0;
      fireEvent.scroll(element);
      rafSpy.mockClear();

      rerenderWith({ conversationId: 'conversation-2', messages: [first] });

      expect(rafSpy).toHaveBeenCalledTimes(1);
    });

    it('keeps sticking when the user scrolls near the bottom', () => {
      const first = message({
        id: 'a',
        parts: [{ id: 'p', text: 'first', type: 'text' }],
      });
      const { rerenderWith } = renderSurface({ messages: [first] });

      const element = scroller();
      Object.defineProperty(element, 'scrollHeight', {
        configurable: true,
        value: 1000,
      });
      Object.defineProperty(element, 'clientHeight', {
        configurable: true,
        value: 100,
      });
      element.scrollTop = 850;
      fireEvent.scroll(element);
      rafSpy.mockClear();

      const reply = message({
        id: 'b',
        parts: [{ id: 'q', text: 'reply', type: 'text' }],
      });
      rerenderWith({ messages: [first, reply] });

      expect(rafSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('AgenticChatSurface prompt library', () => {
  const greeting = prompt({
    id: 'p1',
    parameters: [
      { label: 'Name', name: 'name', required: true },
      { label: 'Mood', name: 'mood', required: false },
    ],
    prompt: 'Hello {{ name }}, feeling {{mood}}? {{unknown}}',
    title: 'Greeting',
  });
  const plain = prompt({ id: 'p2', prompt: 'Just do it', title: 'Plain' });
  const single = prompt({
    id: 'p3',
    parameters: [{ label: 'Topic', name: 'topic', required: true }],
    prompt: 'About {{topic}}',
    title: 'Single',
  });

  const library = (
    overrides: Partial<AgenticPromptLibraryClient> = {},
  ): jest.Mocked<AgenticPromptLibraryClient> =>
    ({
      createPrompt: jest.fn(),
      deletePrompt: jest.fn().mockResolvedValue(undefined),
      listPrompts: jest.fn().mockResolvedValue([greeting, plain, single]),
      updatePrompt: jest.fn(),
      ...overrides,
    }) as any;

  const openLibrary = async (
    promptLibrary: AgenticPromptLibraryClient,
    overrides: Partial<AgenticChatSurfaceProps> = {},
  ) => {
    const view = renderSurface({ promptLibrary, ...overrides });
    fireEvent.click(screen.getByLabelText('Open prompt library'));
    await screen.findByRole('dialog');
    return view;
  };

  const waitForList = () => screen.findByText('Greeting');

  const libraryDialog = () =>
    screen
      .getAllByRole('dialog')
      .find((d) => d.textContent?.includes('Prompt Library')) as HTMLElement;

  let rafSpy: jest.SpyInstance;

  beforeEach(() => {
    rafSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(0);
        return 0;
      });
  });

  afterEach(() => rafSpy.mockRestore());

  it('lists prompts with their parameter counts', async () => {
    const promptLibrary = library();
    await openLibrary(promptLibrary);
    await waitForList();

    expect(promptLibrary.listPrompts).toHaveBeenCalledWith({
      limit: 100,
      search: undefined,
    });
    expect(screen.queryByText('2 parameters')).not.toBeNull();
    expect(screen.queryByText('1 parameter')).not.toBeNull();
    expect(screen.queryByText('No parameters')).not.toBeNull();
    expect(screen.queryByText('Select a prompt')).not.toBeNull();
  });

  it('shows skeletons while the first page loads and an empty state after', async () => {
    let resolve: (prompts: AgenticPrompt[]) => void = () => undefined;
    const promptLibrary = library({
      listPrompts: jest.fn(
        () => new Promise<AgenticPrompt[]>((r) => (resolve = r)),
      ),
    });
    await openLibrary(promptLibrary);

    await waitFor(() => expect(promptLibrary.listPrompts).toHaveBeenCalled());
    expect(libraryDialog().querySelectorAll('.MuiSkeleton-root').length).toBe(
      4,
    );

    await act(async () => resolve([]));

    expect(screen.queryByText('No saved prompts yet')).not.toBeNull();
    fireEvent.click(button('Create your first prompt'));
    expect(screen.queryByText('Create prompt')).not.toBeNull();
  });

  it('fills parameters, previews and inserts the rendered prompt into the composer', async () => {
    const { onSend } = await openLibrary(library());
    await waitForList();

    fireEvent.click(screen.getByText('Greeting'));

    expect(
      screen.queryByText('Hello [Name], feeling [Mood]? [unknown]'),
    ).not.toBeNull();
    const insert = button('Insert into message');
    expect(insert.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: 'Ada' },
    });
    expect(
      screen.queryByText('Hello Ada, feeling [Mood]? [unknown]'),
    ).not.toBeNull();
    expect(insert.disabled).toBe(false);

    fireEvent.click(insert);

    await waitFor(() => expect(composer().value).toBe('Hello Ada, feeling ? '));

    await act(async () => {
      fireEvent.keyDown(composer(), { key: 'Enter' });
    });
    expect(onSend).toHaveBeenCalledWith('Hello Ada, feeling ?', {
      promptLibrary: {
        parameterValues: { mood: '', name: 'Ada' },
        promptId: 'p1',
        title: 'Greeting',
      },
    });
  });

  it('appends to an existing draft and drops the prompt metadata', async () => {
    const promptLibrary = library();
    const { onSend } = renderSurface({ promptLibrary });
    fireEvent.change(composer(), { target: { value: 'Draft' } });

    fireEvent.click(screen.getByLabelText('Open prompt library'));
    await waitForList();
    fireEvent.click(screen.getByText('Plain'));
    expect(
      screen.queryByText('This prompt is ready to insert as written.'),
    ).not.toBeNull();
    fireEvent.click(button('Insert into message'));

    await waitFor(() => expect(composer().value).toBe('Draft\n\nJust do it'));
    await act(async () => {
      fireEvent.keyDown(composer(), { key: 'Enter' });
    });
    expect(onSend).toHaveBeenCalledWith('Draft\n\nJust do it', {});
  });

  it('searches with a debounce and offers to clear an empty result', async () => {
    const promptLibrary = library();
    await openLibrary(promptLibrary);
    await waitForList();

    promptLibrary.listPrompts.mockResolvedValue([]);
    fireEvent.change(screen.getByLabelText('Search prompts'), {
      target: { value: ' zzz ' },
    });

    await screen.findByText('No prompts found');
    expect(promptLibrary.listPrompts).toHaveBeenLastCalledWith({
      limit: 100,
      search: 'zzz',
    });

    promptLibrary.listPrompts.mockResolvedValue([plain]);
    fireEvent.click(button('Clear search'));
    await screen.findByText('Plain');
    expect(
      (screen.getByLabelText('Search prompts') as HTMLInputElement).value,
    ).toBe('');
  });

  it('clears the search from the search field adornment', async () => {
    const promptLibrary = library();
    await openLibrary(promptLibrary);
    await waitForList();

    fireEvent.change(screen.getByLabelText('Search prompts'), {
      target: { value: 'gr' },
    });
    fireEvent.click(screen.getByLabelText('Clear prompt search'));

    expect(
      (screen.getByLabelText('Search prompts') as HTMLInputElement).value,
    ).toBe('');
  });

  it('drops the selection when it disappears from the results', async () => {
    const promptLibrary = library();
    await openLibrary(promptLibrary);
    await waitForList();
    fireEvent.click(screen.getByText('Greeting'));
    expect(button('Insert into message')).toBeTruthy();

    promptLibrary.listPrompts.mockResolvedValue([plain]);
    fireEvent.change(screen.getByLabelText('Search prompts'), {
      target: { value: 'pl' },
    });

    await screen.findByText('Select a prompt');
    expect(
      screen.queryByRole('button', { name: 'Insert into message' }),
    ).toBeNull();
  });

  it('shows a load error with retry', async () => {
    const promptLibrary = library({
      listPrompts: jest.fn().mockRejectedValueOnce(new Error('offline')),
    });
    promptLibrary.listPrompts.mockResolvedValue([plain]);
    await openLibrary(promptLibrary);

    await screen.findByText('offline');
    fireEvent.click(button('Retry'));

    await screen.findByText('Plain');
    expect(screen.queryByText('offline')).toBeNull();
  });

  it('keeps cached prompts on a failed refresh and disables editing', async () => {
    const promptLibrary = library();
    await openLibrary(promptLibrary);
    await waitForList();

    promptLibrary.listPrompts.mockRejectedValue('flaky');
    fireEvent.change(screen.getByLabelText('Search prompts'), {
      target: { value: 'x' },
    });

    await screen.findByText('Showing cached prompts. flaky');
    expect(
      (screen.getByLabelText('Edit Greeting') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText('Delete Greeting') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  describe('creating', () => {
    it('validates the template and saves a new prompt', async () => {
      const created = prompt({
        id: 'new',
        parameters: [
          { label: 'Topic Name', name: 'topicName', required: true },
        ],
        prompt: 'Explain {{topicName}}',
        title: 'Explainer',
      });
      const promptLibrary = library({
        createPrompt: jest.fn().mockResolvedValue(created),
      });
      await openLibrary(promptLibrary);
      await waitForList();

      fireEvent.click(button('New prompt'));
      const save = button('Save prompt');
      expect(save.disabled).toBe(true);
      expect(screen.queryByText('No parameters detected.')).not.toBeNull();

      fireEvent.change(screen.getByLabelText(/^Title/), {
        target: { value: '   ' },
      });
      expect(
        screen.queryByText('Title cannot be only whitespace.'),
      ).not.toBeNull();

      fireEvent.change(screen.getByLabelText(/^Prompt template/), {
        target: { value: '   ' },
      });
      expect(
        screen.queryByText('Prompt cannot be only whitespace.'),
      ).not.toBeNull();

      fireEvent.change(screen.getByLabelText(/^Prompt template/), {
        target: { value: 'Explain {{topicName' },
      });
      expect(
        screen.queryByText(
          'Prompt template has unbalanced parameter delimiters.',
        ),
      ).not.toBeNull();

      fireEvent.change(screen.getByLabelText(/^Title/), {
        target: { value: ' Explainer ' },
      });
      fireEvent.change(screen.getByLabelText(/^Prompt template/), {
        target: { value: ' Explain {{topicName}} ' },
      });
      expect(screen.queryByText('Topic Name')).not.toBeNull();
      expect(save.disabled).toBe(false);

      await act(async () => {
        fireEvent.click(save);
      });

      expect(promptLibrary.createPrompt).toHaveBeenCalledWith({
        prompt: 'Explain {{topicName}}',
        title: 'Explainer',
      });
      expect(screen.queryByText('Prompt created')).not.toBeNull();
      // the saved prompt is selected, ready to fill in
      expect(screen.queryByText('Explain [Topic Name]')).not.toBeNull();
    });

    it('shows the error when saving fails', async () => {
      const promptLibrary = library({
        createPrompt: jest.fn().mockRejectedValue(new Error('denied')),
      });
      await openLibrary(promptLibrary);
      await waitForList();

      fireEvent.click(button('New prompt'));
      fireEvent.change(screen.getByLabelText(/^Title/), {
        target: { value: 'T' },
      });
      fireEvent.change(screen.getByLabelText(/^Prompt template/), {
        target: { value: 'P' },
      });
      await act(async () => {
        fireEvent.click(button('Save prompt'));
      });

      expect(screen.queryByText('denied')).not.toBeNull();
      expect(screen.queryByText('Create prompt')).not.toBeNull();
    });
  });

  describe('editing', () => {
    it('updates an existing prompt', async () => {
      const updated = { ...plain, title: 'Plainer' };
      const promptLibrary = library({
        updatePrompt: jest.fn().mockResolvedValue(updated),
      });
      await openLibrary(promptLibrary);
      await waitForList();

      fireEvent.click(screen.getByLabelText('Edit Plain'));
      expect(screen.queryByText('Edit prompt')).not.toBeNull();
      const title = screen.getByLabelText(/^Title/) as HTMLInputElement;
      expect(title.value).toBe('Plain');
      expect(button('Save prompt').disabled).toBe(true);

      fireEvent.change(title, { target: { value: 'Plainer' } });
      await act(async () => {
        fireEvent.click(button('Save prompt'));
      });

      expect(promptLibrary.updatePrompt).toHaveBeenCalledWith('p2', {
        prompt: 'Just do it',
        title: 'Plainer',
      });
      expect(screen.queryByText('Prompt updated')).not.toBeNull();
      expect(screen.queryAllByText('Plainer').length).toBeGreaterThan(0);
    });

    it('cancels straight back to browsing when nothing changed', async () => {
      await openLibrary(library());
      await waitForList();

      fireEvent.click(screen.getByLabelText('Edit Plain'));
      fireEvent.click(button('Cancel'));

      expect(screen.queryByText('Select a prompt')).not.toBeNull();
      expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
    });

    it('asks before discarding unsaved changes', async () => {
      await openLibrary(library());
      await waitForList();

      fireEvent.click(screen.getByLabelText('Edit Plain'));
      fireEvent.change(screen.getByLabelText(/^Title/), {
        target: { value: 'Changed' },
      });

      fireEvent.click(button('Cancel'));
      await screen.findByText('Discard unsaved changes?');
      fireEvent.click(screen.getByText('Keep editing'));
      await waitFor(() =>
        expect(screen.queryByText('Discard unsaved changes?')).toBeNull(),
      );
      expect(screen.queryByText('Edit prompt')).not.toBeNull();

      fireEvent.click(button('Cancel'));
      await screen.findByText('Discard unsaved changes?');
      fireEvent.click(screen.getByText('Discard changes'));

      await waitFor(() =>
        expect(screen.queryByText('Select a prompt')).not.toBeNull(),
      );
    });

    it('asks before closing the library with unsaved changes', async () => {
      await openLibrary(library());
      await waitForList();

      fireEvent.click(button('New prompt'));
      fireEvent.change(screen.getByLabelText(/^Title/), {
        target: { value: 'Draft' },
      });
      fireEvent.click(screen.getByLabelText('Close prompt library'));
      await screen.findByText('Discard unsaved changes?');
      fireEvent.click(screen.getByText('Discard changes'));

      await waitFor(() =>
        expect(screen.queryByText('Prompt Library')).toBeNull(),
      );
    });

    it('warns when the prompt being edited leaves the results, and recreates it when it is gone', async () => {
      const promptLibrary = library();
      await openLibrary(promptLibrary);
      await waitForList();

      fireEvent.click(screen.getByLabelText('Edit Plain'));

      promptLibrary.listPrompts.mockResolvedValue([greeting]);
      fireEvent.change(screen.getByLabelText('Search prompts'), {
        target: { value: 'gr' },
      });
      await screen.findByText(
        'This prompt is no longer in the current results. Your changes are preserved.',
      );

      fireEvent.change(screen.getByLabelText('Search prompts'), {
        target: { value: '' },
      });
      await screen.findByText(
        'The prompt being edited is no longer available. Your changes are preserved as a new prompt.',
      );
      expect(screen.queryByText('Create prompt')).not.toBeNull();
      expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe(
        'Plain',
      );
    });
  });

  describe('deleting', () => {
    it('deletes a prompt after confirmation and clears its selection', async () => {
      const promptLibrary = library();
      await openLibrary(promptLibrary);
      await waitForList();
      fireEvent.click(screen.getByText('Plain'));

      fireEvent.click(screen.getByLabelText('Delete Plain'));
      await screen.findByText('Delete “Plain”?');
      await act(async () => {
        fireEvent.click(button('Delete prompt'));
      });

      expect(promptLibrary.deletePrompt).toHaveBeenCalledWith('p2');
      expect(screen.queryByText('“Plain” deleted')).not.toBeNull();
      expect(screen.queryByText('Select a prompt')).not.toBeNull();
    });

    it('shows a delete failure and can be cancelled', async () => {
      const promptLibrary = library({
        deletePrompt: jest.fn().mockRejectedValue(new Error('locked')),
      });
      await openLibrary(promptLibrary);
      await waitForList();

      fireEvent.click(screen.getByLabelText('Delete Greeting'));
      await screen.findByText('Delete “Greeting”?');
      await act(async () => {
        fireEvent.click(button('Delete prompt'));
      });
      expect(screen.queryByText('locked')).not.toBeNull();

      const confirm = screen
        .getAllByRole('dialog')
        .find((d) =>
          d.textContent?.includes('Delete “Greeting”?'),
        ) as HTMLElement;
      fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));

      await waitFor(() =>
        expect(screen.queryByText('Delete “Greeting”?')).toBeNull(),
      );
      expect(screen.queryByText('Greeting')).not.toBeNull();
    });
  });

  describe('on a small screen', () => {
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
      window.matchMedia = jest.fn((query: string) => ({
        addEventListener: jest.fn(),
        addListener: jest.fn(),
        dispatchEvent: jest.fn(),
        matches: true,
        media: query,
        onchange: null,
        removeEventListener: jest.fn(),
        removeListener: jest.fn(),
      })) as any;
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it('shows the list first and the detail on its own with a back button', async () => {
      await openLibrary(library());
      await waitForList();

      expect(screen.queryByText('Select a prompt')).toBeNull();
      expect(screen.queryByLabelText('Back to prompts')).toBeNull();

      fireEvent.change(screen.getByLabelText('Search prompts'), {
        target: { value: 'g' },
      });
      fireEvent.click(screen.getByLabelText('Clear prompt search'));
      await waitFor(() =>
        expect(
          (screen.getByText('Plain').closest('button') as HTMLButtonElement)
            .disabled,
        ).toBe(false),
      );

      fireEvent.click(screen.getByText('Plain'));
      expect(screen.queryByText('Single')).toBeNull();

      fireEvent.click(screen.getByLabelText('Back to prompts'));
      expect(screen.queryByText('Single')).not.toBeNull();
    });
  });
});

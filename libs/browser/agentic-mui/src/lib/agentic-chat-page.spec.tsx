import type {
  AgenticConversation,
  AgenticConversationListItem,
} from '@onivoro/isomorphic-agentic';
import { AgenticFetchError } from '@onivoro/browser-agentic';
import type { UseAgenticChatResult } from '@onivoro/browser-agentic';
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
  AgenticChatPageShell,
  AgenticChatPageShellProps,
} from './agentic-chat-page';

// MUI renders are slow under parallel CI load; widen the default timeouts.
configure({ asyncUtilTimeout: 5000 });
jest.setTimeout(20000);

const STORAGE_KEY = 'acme.agentic.conversation';

const conversation = (
  id: string,
  overrides: Partial<AgenticConversationListItem> = {},
): AgenticConversationListItem => ({
  createdAt: '',
  id,
  status: 'active' as any,
  updatedAt: '',
  ...overrides,
});

const chatResult = (
  conversationId: string,
  overrides: Partial<UseAgenticChatResult> = {},
): UseAgenticChatResult => ({
  conversationId,
  isConnected: true,
  isLoading: false,
  isSending: false,
  messages: [],
  reload: jest.fn(),
  sendMessage: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const arrange = (overrides: Partial<AgenticChatPageShellProps> = {}) => {
  const chats = new Map<string, UseAgenticChatResult>();
  const useAgenticChat = jest.fn((id: string) => {
    if (!chats.has(id)) chats.set(id, chatResult(id));
    return chats.get(id) as UseAgenticChatResult;
  });

  const props: AgenticChatPageShellProps = {
    buildConversationPath: (id) => `/chat/${id}`,
    createConversation: jest
      .fn()
      .mockResolvedValue(conversation('created', { title: 'Fresh' })),
    deleteConversation: jest.fn().mockResolvedValue(undefined),
    ensureConversation: jest.fn(({ id }) =>
      Promise.resolve(conversation(id, { title: `Title ${id}` })),
    ),
    listConversations: jest.fn().mockResolvedValue([]),
    localStorageKey: STORAGE_KEY,
    navigate: jest.fn(),
    useAgenticChat,
    ...overrides,
  };

  const view = render(<AgenticChatPageShell {...props} />);

  return {
    ...view,
    chats,
    props: props as AgenticChatPageShellProps & {
      createConversation: jest.Mock;
      deleteConversation: jest.Mock;
      ensureConversation: jest.Mock;
      listConversations: jest.Mock;
      navigate: jest.Mock;
    },
    rerenderWith: (next: Partial<AgenticChatPageShellProps>) =>
      view.rerender(<AgenticChatPageShell {...props} {...next} />),
    useAgenticChat,
  };
};

const ready = () => screen.findByPlaceholderText('Message iGENTiC');

describe('AgenticChatPageShell', () => {
  beforeEach(() => localStorage.clear());

  describe('opening a conversation', () => {
    it('opens the conversation named in the route without navigating', async () => {
      const { props, useAgenticChat } = arrange({ conversationId: 'route-1' });

      expect(screen.queryByText('Opening iGENTiC...')).not.toBeNull();
      await ready();

      expect(props.ensureConversation).toHaveBeenCalledWith({ id: 'route-1' });
      expect(props.createConversation).not.toHaveBeenCalled();
      expect(props.navigate).not.toHaveBeenCalled();
      expect(localStorage.getItem(STORAGE_KEY)).toBe('route-1');
      expect(useAgenticChat).toHaveBeenCalledWith('route-1');
      expect(
        (await screen.findAllByText('Title route-1')).length,
      ).toBeGreaterThan(0);
    });

    it('reopens the stored conversation and puts it in the route', async () => {
      localStorage.setItem(STORAGE_KEY, 'stored-1');
      const { props } = arrange();
      await ready();

      expect(props.ensureConversation).toHaveBeenCalledWith({ id: 'stored-1' });
      expect(props.navigate).toHaveBeenCalledWith('/chat/stored-1', {
        replace: true,
      });
    });

    it('starts a new conversation when the stored one no longer exists', async () => {
      localStorage.setItem(STORAGE_KEY, 'gone');
      const { props } = arrange({
        ensureConversation: jest
          .fn()
          .mockRejectedValue(new AgenticFetchError('missing', 404)),
      });
      await ready();

      expect(props.createConversation).toHaveBeenCalled();
      expect(localStorage.getItem(STORAGE_KEY)).toBe('created');
      expect(props.navigate).toHaveBeenCalledWith('/chat/created', {
        replace: true,
      });
    });

    it('reports other failures to reopen the stored conversation', async () => {
      localStorage.setItem(STORAGE_KEY, 'stored-1');
      const { props } = arrange({
        ensureConversation: jest
          .fn()
          .mockRejectedValue(new AgenticFetchError('server down', 500)),
      });

      await screen.findByText('Could not open iGENTiC');
      expect(screen.queryByText('server down')).not.toBeNull();
      expect(props.createConversation).not.toHaveBeenCalled();
      expect(localStorage.getItem(STORAGE_KEY)).toBe('stored-1');
    });

    it('creates a conversation when nothing is stored', async () => {
      const { props } = arrange();
      await ready();

      expect(props.ensureConversation).not.toHaveBeenCalled();
      expect(props.createConversation).toHaveBeenCalled();
    });

    it('stringifies a non-Error failure', async () => {
      arrange({ createConversation: jest.fn().mockRejectedValue('nope') });

      await screen.findByText('nope');
    });

    it('does not reopen a conversation that is already open when the route catches up', async () => {
      const { props, rerenderWith } = arrange();
      await ready();
      expect(props.navigate).toHaveBeenCalledWith('/chat/created', {
        replace: true,
      });

      rerenderWith({ conversationId: 'created' });

      expect(props.ensureConversation).not.toHaveBeenCalled();
      expect(props.createConversation).toHaveBeenCalledTimes(1);
    });

    it('ignores a result that lands after the route moved on', async () => {
      let resolveFirst: (c: AgenticConversation) => void = () => undefined;
      const ensureConversation = jest.fn(({ id }: { id: string }) =>
        id === 'first'
          ? new Promise<AgenticConversation>((r) => (resolveFirst = r))
          : Promise.resolve(conversation(id)),
      );
      const { props, rerenderWith, useAgenticChat } = arrange({
        conversationId: 'first',
        ensureConversation,
      });

      rerenderWith({ conversationId: 'second' });
      await ready();
      await act(async () => resolveFirst(conversation('first')));

      expect(useAgenticChat).not.toHaveBeenCalledWith('first');
      expect(localStorage.getItem(STORAGE_KEY)).toBe('second');
      expect(props.navigate).not.toHaveBeenCalled();
    });

    it('wraps the content in the page shell', async () => {
      arrange({
        pageShell: (children) => <main aria-label="shell">{children}</main>,
      });

      expect(screen.getByLabelText('shell').textContent).toContain(
        'Opening iGENTiC...',
      );
      await ready();
    });
  });

  describe('sidebar', () => {
    it('lists conversations after a short delay', async () => {
      const { props } = arrange({
        conversationId: 'a',
        listConversations: jest
          .fn()
          .mockResolvedValue([
            conversation('a', { preview: 'first preview', title: 'Alpha' }),
            conversation('b'),
          ]),
      });

      await screen.findByText('first preview');
      expect(props.listConversations).toHaveBeenCalledWith({
        limit: 50,
        search: undefined,
      });
      expect(screen.queryByText('Untitled chat')).not.toBeNull();
      // the id stands in for a missing preview
      expect(screen.queryByText('b')).not.toBeNull();
    });

    it('shows loading and empty states', async () => {
      let resolve: (items: AgenticConversationListItem[]) => void = () =>
        undefined;
      arrange({
        // keep bootstrap from adding the opened conversation to the list
        createConversation: jest.fn(() => new Promise(() => undefined)),
        listConversations: jest.fn(
          () => new Promise((r) => (resolve = r as typeof resolve)),
        ),
      });

      await screen.findByText('Loading chats...');
      await act(async () => resolve([]));

      expect(screen.queryByText('No chats found.')).not.toBeNull();
    });

    it('searches conversations', async () => {
      const { props } = arrange({ conversationId: 'a' });
      await ready();

      fireEvent.change(screen.getByPlaceholderText('Search chats'), {
        target: { value: ' alpha ' },
      });

      await waitFor(() =>
        expect(props.listConversations).toHaveBeenLastCalledWith({
          limit: 50,
          search: 'alpha',
        }),
      );
    });

    it('selects a conversation', async () => {
      const { props } = arrange({
        conversationId: 'a',
        listConversations: jest
          .fn()
          .mockResolvedValue([conversation('b', { title: 'Beta' })]),
      });
      await screen.findByText('Beta');

      fireEvent.click(screen.getByText('Beta'));

      expect(localStorage.getItem(STORAGE_KEY)).toBe('b');
      expect(props.navigate).toHaveBeenCalledWith('/chat/b');
    });

    it('starts a new chat', async () => {
      const { props } = arrange({ conversationId: 'a' });
      await ready();

      await act(async () => {
        fireEvent.click(screen.getByLabelText('New chat'));
      });

      expect(props.createConversation).toHaveBeenCalled();
      expect(localStorage.getItem(STORAGE_KEY)).toBe('created');
      expect(props.navigate).toHaveBeenCalledWith('/chat/created');
    });

    it('shows the error when a new chat cannot be created', async () => {
      const { props } = arrange({ conversationId: 'a' });
      await ready();
      props.createConversation.mockRejectedValue(new Error('quota'));

      await act(async () => {
        fireEvent.click(screen.getByLabelText('New chat'));
      });

      expect(screen.queryByText('Could not open iGENTiC')).not.toBeNull();
      expect(screen.queryByText('quota')).not.toBeNull();
    });
  });

  describe('thread', () => {
    it('shows the workflow label and reloads the list after sending', async () => {
      const { chats, props } = arrange({
        conversationId: 'a',
        listConversations: jest.fn().mockResolvedValue([
          conversation('a', {
            metadata: { workflowLabel: 'Intake' },
            title: 'Alpha',
          }),
        ]),
      });
      await screen.findByText('Workflow: Intake');

      const calls = props.listConversations.mock.calls.length;
      fireEvent.change(screen.getByPlaceholderText('Message iGENTiC'), {
        target: { value: 'hi' },
      });
      await act(async () => {
        fireEvent.keyDown(screen.getByPlaceholderText('Message iGENTiC'), {
          key: 'Enter',
        });
      });

      expect(chats.get('a')?.sendMessage).toHaveBeenCalledWith('hi', {});
      expect(props.listConversations.mock.calls.length).toBe(calls + 1);
    });

    it('ignores a blank workflow label and falls back to the id for an untitled conversation', async () => {
      arrange({
        conversationId: 'a',
        ensureConversation: jest.fn().mockResolvedValue(conversation('a')),
        listConversations: jest
          .fn()
          .mockResolvedValue([
            conversation('a', { metadata: { workflowLabel: '  ' } }),
          ]),
      });
      await ready();

      await waitFor(() =>
        expect(screen.queryAllByText('a').length).toBeGreaterThan(0),
      );
      expect(screen.queryByText(/Workflow:/)).toBeNull();
    });
  });

  describe('deleting', () => {
    const deleteDialog = () =>
      screen
        .getAllByRole('dialog')
        .find((d) =>
          d.textContent?.includes('Delete Conversation?'),
        ) as HTMLElement;

    const listing = [
      conversation('a', { title: 'Alpha' }),
      conversation('b', { preview: 'Beta preview' }),
    ];

    it('deletes another conversation and refreshes the list', async () => {
      localStorage.setItem(STORAGE_KEY, 'a');
      const { props } = arrange({
        conversationId: 'a',
        listConversations: jest.fn().mockResolvedValue(listing),
      });
      await screen.findByText('Beta preview');

      fireEvent.click(screen.getByLabelText('Delete conversation b'));
      await screen.findByText('Delete Conversation?');
      // label falls back to the preview when untitled
      expect(within(deleteDialog()).queryByText('Beta preview')).not.toBeNull();

      const listCalls = props.listConversations.mock.calls.length;
      props.listConversations.mockResolvedValue([listing[0]]);
      await act(async () => {
        fireEvent.click(within(deleteDialog()).getByText('Delete'));
      });

      expect(props.deleteConversation).toHaveBeenCalledWith('b');
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(props.listConversations.mock.calls.length).toBe(listCalls + 1);
      expect(props.createConversation).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(screen.queryByText('Delete Conversation?')).toBeNull(),
      );
    });

    it('replaces the active conversation with a new one when it is deleted', async () => {
      const { props } = arrange({
        conversationId: 'a',
        listConversations: jest.fn().mockResolvedValue(listing),
      });
      await screen.findByText('Beta preview');

      fireEvent.click(screen.getByLabelText('Delete conversation Alpha'));
      await screen.findByText('Delete Conversation?');
      await act(async () => {
        fireEvent.click(within(deleteDialog()).getByText('Delete'));
      });

      expect(props.deleteConversation).toHaveBeenCalledWith('a');
      expect(props.createConversation).toHaveBeenCalled();
      expect(localStorage.getItem(STORAGE_KEY)).toBe('created');
      expect(props.navigate).toHaveBeenCalledWith('/chat/created', {
        replace: true,
      });
    });

    it('shows a failure in the dialog and can be cancelled', async () => {
      const { props } = arrange({
        conversationId: 'a',
        deleteConversation: jest.fn().mockRejectedValue(new Error('forbidden')),
        listConversations: jest.fn().mockResolvedValue(listing),
      });
      await screen.findByText('Beta preview');

      fireEvent.click(screen.getByLabelText('Delete conversation b'));
      await screen.findByText('Delete Conversation?');
      await act(async () => {
        fireEvent.click(within(deleteDialog()).getByText('Delete'));
      });

      expect(within(deleteDialog()).queryByText('forbidden')).not.toBeNull();
      expect(props.navigate).not.toHaveBeenCalled();

      fireEvent.click(within(deleteDialog()).getByText('Cancel'));
      await waitFor(() =>
        expect(screen.queryByText('Delete Conversation?')).toBeNull(),
      );
    });
  });
});

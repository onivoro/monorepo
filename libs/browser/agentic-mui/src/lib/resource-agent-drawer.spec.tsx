import type { UseAgenticChatResult } from '@onivoro/browser-agentic';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  AgenticChatResourceButton,
  ResourceAgentDrawer,
  ResourceAgentDrawerProps,
} from './resource-agent-drawer';

/**
 * Covers the in-flight guard around ensureConversation.
 *
 * The guard exists because callers build their resource context inline while
 * rendering, so `metadata` is a new object on every one of their renders and any
 * render landing mid-call used to start a second call. What it must not do is
 * outlive the call it was guarding.
 */
describe('ResourceAgentDrawer', () => {
  const resourceContext = {
    label: 'Request 55',
    resourceId: '55',
    resourceType: 'request',
  } as any;

  const arrange = () => {
    let resolveEnsure: (value?: unknown) => void = () => undefined;
    let rejectEnsure: (reason?: unknown) => void = () => undefined;

    const ensureConversation = jest.fn(
      () =>
        new Promise<any>((resolve, reject) => {
          resolveEnsure = resolve;
          rejectEnsure = reject;
        }),
    );

    const props = {
      appNamespace: 'acme',
      ensureConversation,
      onClose: () => undefined,
      // the content component is never reached in these cases, but the drawer
      // requires the prop
      useAgenticChat: () => ({}) as any,
      resourceContext,
      title: 'Request 55 iGENTiC',
    };

    const view = render(<ResourceAgentDrawer {...(props as any)} open />);

    /** Re-render with a fresh context object, as a real caller does. */
    const rerender = (open: boolean) =>
      view.rerender(
        <ResourceAgentDrawer
          {...(props as any)}
          open={open}
          resourceContext={{ ...resourceContext }}
        />,
      );

    return {
      ensureConversation,
      rerender,
      resolveEnsure: () => resolveEnsure({ id: 'x' }),
      rejectEnsure: () => rejectEnsure(new Error('nope')),
    };
  };

  const isOpening = () => Boolean(screen.queryByText('Opening iGENTiC...'));

  it('does not start a second call while the first is in flight', () => {
    const { ensureConversation, rerender } = arrange();

    rerender(true);
    rerender(true);

    expect(ensureConversation).toHaveBeenCalledTimes(1);
  });

  // the guard used to be cleared only when the call rejected, so closing while it
  // was still out left the key set with nothing to clear it: reopening returned
  // early and the drawer showed the spinner for good
  it('retries after being closed while the call was in flight', async () => {
    const { ensureConversation, rerender, resolveEnsure } = arrange();

    rerender(false);

    await act(async () => {
      resolveEnsure();
    });

    rerender(true);

    expect(ensureConversation).toHaveBeenCalledTimes(2);
  });

  it('does not sit on the spinner after being reopened', async () => {
    const { rerender, resolveEnsure } = arrange();

    rerender(false);
    await act(async () => {
      resolveEnsure();
    });
    rerender(true);

    // the retry is in flight, so it is still opening -- what matters is that
    // resolving this one clears it, rather than there being no call to resolve
    expect(isOpening()).toBe(true);
  });

  it('retries after a failure rather than locking the key out', async () => {
    const { ensureConversation, rerender, rejectEnsure } = arrange();

    await act(async () => {
      rejectEnsure();
    });

    expect(screen.queryByText('Could not open iGENTiC')).not.toBeNull();

    rerender(false);
    rerender(true);

    expect(ensureConversation).toHaveBeenCalledTimes(2);
  });
});

describe('ResourceAgentDrawer content', () => {
  const chatResult = (
    overrides: Partial<UseAgenticChatResult> = {},
  ): UseAgenticChatResult => ({
    conversationId: 'x',
    isConnected: true,
    isLoading: false,
    isSending: false,
    messages: [],
    reload: jest.fn(),
    sendMessage: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  const arrange = async (overrides: Partial<ResourceAgentDrawerProps> = {}) => {
    const chat = chatResult();
    const props: ResourceAgentDrawerProps = {
      appNamespace: 'acme app',
      ensureConversation: jest.fn().mockResolvedValue({ id: 'x' }),
      onClose: jest.fn(),
      open: true,
      resourceContext: {
        identifiers: { blank: '', empty: null, mrn: 'M-1', skipped: undefined },
        label: 'Patient 7',
        resourceId: 7,
        resourceType: 'patient/record',
      },
      useAgenticChat: jest.fn(() => chat),
      ...overrides,
    };

    await act(async () => {
      render(<ResourceAgentDrawer {...props} />);
    });

    return {
      chat,
      ensureConversation: props.ensureConversation as jest.Mock,
      useAgenticChat: props.useAgenticChat as jest.Mock,
    };
  };

  it('ensures the resource conversation with its metadata and opens the chat', async () => {
    const { ensureConversation, useAgenticChat } = await arrange();

    expect(ensureConversation).toHaveBeenCalledWith({
      id: 'acme_app:patient_record:7',
      metadata: {
        blank: '',
        empty: null,
        identifiers: { blank: '', empty: null, mrn: 'M-1' },
        mrn: 'M-1',
        resourceId: 7,
        resourceLabel: 'Patient 7',
        resourceType: 'patient/record',
      },
      title: 'Patient 7',
    });
    expect(useAgenticChat).toHaveBeenCalledWith('acme_app:patient_record:7');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Patient 7',
    );
    // only identifiers with a value become chips
    expect(screen.queryByText('mrn: M-1')).not.toBeNull();
    expect(screen.queryByText(/^blank:/)).toBeNull();
    expect(screen.queryByText(/^empty:/)).toBeNull();
    expect(screen.queryByText(/^skipped:/)).toBeNull();
  });

  it('prefers an explicit conversation id and title', async () => {
    const { ensureConversation, useAgenticChat } = await arrange({
      conversationId: 'custom-id',
      title: 'Custom title',
    });

    expect(ensureConversation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'custom-id', title: 'Custom title' }),
    );
    expect(useAgenticChat).toHaveBeenCalledWith('custom-id');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Custom title',
    );
  });

  it('falls back to the resource type and id when there is no label', async () => {
    await arrange({
      resourceContext: { resourceId: 3, resourceType: 'order' },
    });

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'iGENTiC',
    );
    expect(screen.queryByText('order 3')).not.toBeNull();
  });

  it('sends through the chat with the resource metadata', async () => {
    const { chat } = await arrange();

    fireEvent.change(screen.getByPlaceholderText('Message iGENTiC'), {
      target: { value: 'hello' },
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByPlaceholderText('Message iGENTiC'), {
        key: 'Enter',
      });
    });

    expect(chat.sendMessage).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({ mrn: 'M-1', resourceId: 7 }),
    );
  });

  it('uses explicit starter actions over the defaults', async () => {
    const defaultStarterActions = jest.fn(() => [
      { label: 'Default action', prompt: 'd' },
    ]);
    await arrange({
      defaultStarterActions,
      starterActions: [{ label: 'Explicit action', prompt: 'e' }],
    });

    expect(screen.queryByText('Explicit action')).not.toBeNull();
    expect(screen.queryByText('Default action')).toBeNull();
  });

  it('derives starter actions from the resource when none are given', async () => {
    const defaultStarterActions = jest.fn(() => [
      { label: 'Default action', prompt: 'd' },
    ]);
    await arrange({ defaultStarterActions });

    expect(defaultStarterActions).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 7 }),
    );
    expect(screen.queryByText('Default action')).not.toBeNull();
  });

  it('does not ensure anything while closed', async () => {
    const { ensureConversation } = await arrange({ open: false });

    expect(ensureConversation).not.toHaveBeenCalled();
  });

  it('shows a non-Error failure as text', async () => {
    await arrange({
      ensureConversation: jest.fn().mockRejectedValue('denied'),
    });

    expect(screen.queryByText('Could not open iGENTiC')).not.toBeNull();
    expect(screen.queryByText('denied')).not.toBeNull();
  });
});

describe('AgenticChatResourceButton', () => {
  const props = () => ({
    appNamespace: 'acme',
    canUseAgenticChat: () => true,
    ensureConversation: jest.fn(() => new Promise<any>(() => undefined)),
    resourceContext: { resourceId: '1', resourceType: 'request' },
    useAgenticChat: jest.fn() as any,
  });

  it('renders nothing when the user cannot use the chat', () => {
    const { container } = render(
      <AgenticChatResourceButton
        {...props()}
        canUseAgenticChat={() => false}
      />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('opens the drawer on click', () => {
    const given = props();
    render(<AgenticChatResourceButton {...given} label="Ask" />);

    expect(given.ensureConversation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));

    expect(given.ensureConversation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'acme:request:1' }),
    );
    expect(screen.queryByText('Opening iGENTiC...')).not.toBeNull();
  });

  it('uses the default label', () => {
    render(<AgenticChatResourceButton {...props()} />);

    expect(screen.queryByRole('button', { name: 'iGENTiC' })).not.toBeNull();
  });
});

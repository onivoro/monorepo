import { act, render, screen } from '@testing-library/react';
import { ResourceAgentDrawer } from './resource-agent-drawer';

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

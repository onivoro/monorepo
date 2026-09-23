import Psychology from '@mui/icons-material/Psychology';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AgenticConversation,
  JsonObject,
} from '@onivoro/isomorphic-agentic';
import { AgenticChatSurface } from './agentic-chat-surface';
import type {
  AgenticChatResourceContext,
  AgenticPromptLibraryClient,
  AgenticStarterAction,
} from '@onivoro/browser-agentic';
import {
  agenticResourceConversationId,
  resourceContextMetadata,
} from '@onivoro/browser-agentic';
import type { UseAgenticChatResult } from '@onivoro/browser-agentic';

export interface ResourceAgentDrawerProps {
  appNamespace: string;
  conversationId?: string;
  defaultStarterActions?: (
    resourceContext: AgenticChatResourceContext,
  ) => AgenticStarterAction[];
  ensureConversation: (input: {
    id: string;
    title?: string;
    metadata?: JsonObject;
  }) => Promise<AgenticConversation>;
  onClose: () => void;
  open: boolean;
  promptLibrary?: AgenticPromptLibraryClient;
  resourceContext: AgenticChatResourceContext;
  starterActions?: AgenticStarterAction[];
  title?: string;
  useAgenticChat: (conversationId: string) => UseAgenticChatResult;
}

export const ResourceAgentDrawer: FC<ResourceAgentDrawerProps> = ({
  appNamespace,
  conversationId,
  defaultStarterActions,
  ensureConversation,
  onClose,
  open,
  promptLibrary,
  resourceContext,
  starterActions,
  title,
  useAgenticChat,
}) => {
  const drawerConversationId =
    conversationId ??
    agenticResourceConversationId(
      appNamespace,
      resourceContext.resourceType,
      resourceContext.resourceId,
    );
  const metadata = useMemo(
    () => resourceContextMetadata(resourceContext),
    [resourceContext],
  );
  const metadataFingerprint = useMemo(
    () => JSON.stringify(metadata ?? {}),
    [metadata],
  );
  const ensureKey = `${drawerConversationId}:${metadataFingerprint}:${title ?? resourceContext.label ?? ''}`;
  const [isEnsuring, setIsEnsuring] = useState(false);
  const [ensureError, setEnsureError] = useState<string>();
  const [readyEnsureKey, setReadyEnsureKey] = useState<string>();
  // readyEnsureKey only closes the door once the call has come back. Callers
  // build their resource context inline while rendering, so metadata is a new
  // object on each of their renders, and any render landing while the first
  // call was still in flight used to start a second one. This is the same key
  // recorded at the point the call goes out rather than the point it lands.
  const ensuringKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    if (readyEnsureKey === ensureKey) return;
    if (ensuringKeyRef.current === ensureKey) return;

    let cancelled = false;
    ensuringKeyRef.current = ensureKey;
    setIsEnsuring(true);
    setEnsureError(undefined);

    ensureConversation({
      id: drawerConversationId,
      metadata,
      title: title ?? resourceContext.label,
    })
      .then(() => {
        if (!cancelled) setReadyEnsureKey(ensureKey);
      })
      .catch((caught) => {
        if (!cancelled)
          setEnsureError(
            caught instanceof Error ? caught.message : String(caught),
          );
      })
      .finally(() => {
        // Cleared here rather than only on failure. By the time finally runs the
        // call is no longer in flight, so the guard has nothing left to guard in
        // any outcome: a success is held shut by readyEnsureKey below, and a
        // failure or a cancellation both have to be free to retry.
        //
        // Clearing it only on the failure path meant closing the drawer while
        // the call was still out left the key set with readyEnsureKey never
        // written and isEnsuring never lowered -- reopening then returned early
        // above and sat on the spinner for good.
        ensuringKeyRef.current = undefined;
        if (!cancelled) setIsEnsuring(false);
      });

    return () => {
      cancelled = true;
    };
    // deliberately keyed on the ensure key alone: it is a string built from
    // everything the call depends on, where metadata and the context are
    // objects that change identity without changing meaning
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureKey, open, readyEnsureKey]);

  return (
    <Drawer anchor="right" onClose={onClose} open={open}>
      <Box
        sx={{
          display: 'flex',
          height: '100dvh',
          width: { md: 640, sm: 560, xs: '100vw' },
        }}
      >
        {ensureError ? (
          <Stack gap={1} justifyContent="center" sx={{ flexGrow: 1, p: 2 }}>
            <Typography color="error" fontWeight={700}>
              Could not open iGENTiC
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {ensureError}
            </Typography>
          </Stack>
        ) : isEnsuring || readyEnsureKey !== ensureKey ? (
          <Stack
            alignItems="center"
            direction="row"
            gap={1.5}
            justifyContent="center"
            sx={{ flexGrow: 1, p: 2 }}
          >
            <CircularProgress size={20} />
            <Typography color="text.secondary">Opening iGENTiC...</Typography>
          </Stack>
        ) : (
          <ResourceAgentDrawerContent
            conversationId={drawerConversationId}
            error={ensureError}
            promptLibrary={promptLibrary}
            resourceContext={resourceContext}
            starterActions={
              starterActions ?? defaultStarterActions?.(resourceContext) ?? []
            }
            title={title}
            useAgenticChat={useAgenticChat}
          />
        )}
      </Box>
    </Drawer>
  );
};

export const AgenticChatResourceButton: FC<{
  appNamespace: string;
  canUseAgenticChat: () => boolean;
  conversationId?: string;
  defaultStarterActions?: (
    resourceContext: AgenticChatResourceContext,
  ) => AgenticStarterAction[];
  ensureConversation: ResourceAgentDrawerProps['ensureConversation'];
  label?: string;
  promptLibrary?: AgenticPromptLibraryClient;
  resourceContext: AgenticChatResourceContext;
  size?: 'small' | 'medium' | 'large';
  starterActions?: AgenticStarterAction[];
  title?: string;
  useAgenticChat: (conversationId: string) => UseAgenticChatResult;
  variant?: 'contained' | 'outlined' | 'text';
}> = ({
  appNamespace,
  canUseAgenticChat,
  conversationId,
  defaultStarterActions,
  ensureConversation,
  label = 'iGENTiC',
  promptLibrary,
  resourceContext,
  size = 'small',
  starterActions,
  title,
  useAgenticChat,
  variant = 'outlined',
}) => {
  const [open, setOpen] = useState(false);
  if (!canUseAgenticChat()) return null;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size={size}
        startIcon={<Psychology />}
        variant={variant}
      >
        {label}
      </Button>
      <ResourceAgentDrawer
        appNamespace={appNamespace}
        conversationId={conversationId}
        defaultStarterActions={defaultStarterActions}
        ensureConversation={ensureConversation}
        onClose={() => setOpen(false)}
        open={open}
        promptLibrary={promptLibrary}
        resourceContext={resourceContext}
        starterActions={starterActions}
        title={title}
        useAgenticChat={useAgenticChat}
      />
    </>
  );
};

const ResourceAgentDrawerContent: FC<{
  conversationId: string;
  error?: string;
  promptLibrary?: AgenticPromptLibraryClient;
  resourceContext: AgenticChatResourceContext;
  starterActions: AgenticStarterAction[];
  title?: string;
  useAgenticChat: (conversationId: string) => UseAgenticChatResult;
}> = ({
  conversationId,
  error,
  promptLibrary,
  resourceContext,
  starterActions,
  title,
  useAgenticChat,
}) => {
  const chat = useAgenticChat(conversationId);

  return (
    <AgenticChatSurface
      conversationId={conversationId}
      error={error ?? chat.error}
      heading={title ?? resourceContext.label ?? 'iGENTiC'}
      isConnected={chat.isConnected}
      isLoading={chat.isLoading}
      isSending={chat.isSending}
      messages={chat.messages}
      onSend={chat.sendMessage}
      promptLibrary={promptLibrary}
      resourceContext={resourceContext}
      starterActions={starterActions}
      subheading={
        <ResourceContextSubheading resourceContext={resourceContext} />
      }
    />
  );
};

const ResourceContextSubheading: FC<{
  resourceContext: AgenticChatResourceContext;
}> = ({ resourceContext }) => {
  const identifiers = Object.entries(resourceContext.identifiers ?? {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );

  return (
    <Stack gap={0.75} minWidth={0}>
      <Typography
        color="text.secondary"
        noWrap
        sx={{ maxWidth: { md: 520, xs: '100%' } }}
        variant="body2"
      >
        {resourceContext.label ??
          `${resourceContext.resourceType} ${resourceContext.resourceId}`}
      </Typography>
      {identifiers.length ? (
        <Stack direction="row" gap={0.5} sx={{ flexWrap: 'wrap' }}>
          {identifiers.map(([key, value]) => (
            <Chip
              key={key}
              label={`${key}: ${value}`}
              size="small"
              sx={{ maxWidth: 240 }}
              variant="outlined"
            />
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
};

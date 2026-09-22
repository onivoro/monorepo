import type {
  AgenticConversation,
  AgenticConversationListItem,
} from '@onivoro/isomorphic-agentic';
import {
  AddOutlined,
  ChatOutlined,
  DeleteOutline,
  SearchOutlined,
  Psychology,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isAgenticFetchStatus } from '@onivoro/browser-agentic';
import { AgenticChatSurface } from './agentic-chat-surface';
import type {
  AgenticPromptLibraryClient,
  AgenticStarterAction,
} from '@onivoro/browser-agentic';
import type { UseAgenticChatResult } from '@onivoro/browser-agentic';

type BootstrapState =
  | { status: 'loading' }
  | { status: 'ready'; conversationId: string }
  | { error: string; status: 'error' };

export interface AgenticChatPageShellProps {
  buildConversationPath: (conversationId: string) => string;
  conversationId?: string;
  createConversation: () => Promise<AgenticConversation>;
  deleteConversation: (conversationId: string) => Promise<void>;
  ensureConversation: (input: { id: string }) => Promise<AgenticConversation>;
  heading?: string;
  listConversations: (options: {
    limit?: number;
    search?: string;
  }) => Promise<AgenticConversationListItem[]>;
  localStorageKey: string;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  pageShell?: (children: ReactNode) => ReactNode;
  promptLibrary?: AgenticPromptLibraryClient;
  starterActions?: AgenticStarterAction[];
  useAgenticChat: (conversationId: string) => UseAgenticChatResult;
}

export const AgenticChatPageShell: FC<AgenticChatPageShellProps> = ({
  buildConversationPath,
  conversationId: routeConversationId,
  createConversation,
  deleteConversation,
  ensureConversation,
  heading = 'iGENTiC',
  listConversations,
  localStorageKey,
  navigate,
  pageShell,
  promptLibrary,
  starterActions,
  useAgenticChat,
}) => {
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState<
    AgenticConversationListItem[]
  >([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [bootstrap, setBootstrap] = useState<BootstrapState>({
    status: 'loading',
  });
  const [conversationPendingDelete, setConversationPendingDelete] =
    useState<AgenticConversationListItem>();
  const [deleteError, setDeleteError] = useState<string>();
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const readyConversationIdRef = useRef<string | undefined>(undefined);

  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      setConversations(
        await listConversations({
          limit: 50,
          search: search.trim() || undefined,
        }),
      );
    } finally {
      setIsLoadingConversations(false);
    }
  }, [listConversations, search]);

  useEffect(() => {
    if (
      routeConversationId &&
      readyConversationIdRef.current === routeConversationId
    )
      return;

    let cancelled = false;
    setBootstrap({ status: 'loading' });

    openInitialConversation({
      createConversation,
      ensureConversation,
      localStorageKey,
      requestedConversationId: routeConversationId,
    })
      .then((conversation) => {
        if (cancelled) return;
        localStorage.setItem(localStorageKey, conversation.id);
        readyConversationIdRef.current = conversation.id;
        setConversations((items) => upsertConversation(items, conversation));
        setBootstrap({ conversationId: conversation.id, status: 'ready' });
        if (routeConversationId !== conversation.id)
          navigate(buildConversationPath(conversation.id), { replace: true });
      })
      .catch((caught) => {
        if (!cancelled) {
          readyConversationIdRef.current = undefined;
          setBootstrap({ error: errorMessage(caught), status: 'error' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    buildConversationPath,
    createConversation,
    ensureConversation,
    localStorageKey,
    navigate,
    routeConversationId,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadConversations(), 150);
    return () => window.clearTimeout(timeout);
  }, [loadConversations]);

  const newChat = useCallback(async () => {
    setBootstrap({ status: 'loading' });
    try {
      const conversation = await createConversation();
      localStorage.setItem(localStorageKey, conversation.id);
      readyConversationIdRef.current = conversation.id;
      setConversations((items) => upsertConversation(items, conversation));
      setBootstrap({ conversationId: conversation.id, status: 'ready' });
      navigate(buildConversationPath(conversation.id));
    } catch (caught) {
      readyConversationIdRef.current = undefined;
      setBootstrap({ error: errorMessage(caught), status: 'error' });
    }
  }, [buildConversationPath, createConversation, localStorageKey, navigate]);

  const selectConversation = useCallback(
    (id: string) => {
      localStorage.setItem(localStorageKey, id);
      navigate(buildConversationPath(id));
    },
    [buildConversationPath, localStorageKey, navigate],
  );

  const activeConversationId =
    bootstrap.status === 'ready'
      ? bootstrap.conversationId
      : (routeConversationId ?? '');
  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === activeConversationId,
      ),
    [activeConversationId, conversations],
  );

  const requestDeleteConversation = useCallback(
    (id: string) => {
      const conversation = conversations.find((item) => item.id === id);
      if (!conversation) return;
      setDeleteError(undefined);
      setConversationPendingDelete(conversation);
    },
    [conversations],
  );

  const closeDeleteConversationDialog = useCallback(() => {
    if (isDeletingConversation) return;
    setConversationPendingDelete(undefined);
    setDeleteError(undefined);
  }, [isDeletingConversation]);

  const confirmDeleteConversation = useCallback(async () => {
    const conversation = conversationPendingDelete;
    if (!conversation) return;

    const id = conversation.id;
    setIsDeletingConversation(true);
    setDeleteError(undefined);

    try {
      await deleteConversation(id);
      localStorage.removeItem(localStorageKey);
      setConversations((items) => items.filter((item) => item.id !== id));
      setConversationPendingDelete(undefined);

      if (id === activeConversationId) {
        setBootstrap({ status: 'loading' });
        const nextConversation = await createConversation();
        localStorage.setItem(localStorageKey, nextConversation.id);
        readyConversationIdRef.current = nextConversation.id;
        setConversations((items) =>
          upsertConversation(items, nextConversation),
        );
        setBootstrap({ conversationId: nextConversation.id, status: 'ready' });
        navigate(buildConversationPath(nextConversation.id), { replace: true });
      } else {
        await loadConversations();
      }
    } catch (caught) {
      setDeleteError(errorMessage(caught));
    } finally {
      setIsDeletingConversation(false);
    }
  }, [
    activeConversationId,
    buildConversationPath,
    conversationPendingDelete,
    createConversation,
    deleteConversation,
    loadConversations,
    localStorageKey,
    navigate,
  ]);

  const content = (
    <Box
      sx={{
        display: 'flex',
        flexGrow: 1,
        height: { sm: 'calc(100dvh - 64px)', xs: 'calc(100dvh - 56px)' },
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <ConversationSidebar
        activeConversationId={activeConversationId}
        conversations={conversations}
        isLoading={isLoadingConversations}
        onDeleteConversation={requestDeleteConversation}
        onNewChat={newChat}
        onSearchChange={setSearch}
        onSelectConversation={selectConversation}
        search={search}
      />
      {bootstrap.status === 'ready' ? (
        <AgenticChatThread
          activeConversation={activeConversation}
          conversationId={bootstrap.conversationId}
          heading={heading}
          loadConversations={loadConversations}
          promptLibrary={promptLibrary}
          starterActions={starterActions}
          useAgenticChat={useAgenticChat}
        />
      ) : (
        <BootstrapPanel
          error={bootstrap.status === 'error' ? bootstrap.error : undefined}
        />
      )}
      <DeleteConversationDialog
        conversation={conversationPendingDelete}
        error={deleteError}
        isDeleting={isDeletingConversation}
        onClose={closeDeleteConversationDialog}
        onConfirm={confirmDeleteConversation}
      />
    </Box>
  );

  return <>{pageShell ? pageShell(content) : content}</>;
};

const AgenticChatThread: FC<{
  activeConversation?: AgenticConversationListItem;
  conversationId: string;
  heading: string;
  loadConversations: () => Promise<void>;
  promptLibrary?: AgenticPromptLibraryClient;
  starterActions?: AgenticStarterAction[];
  useAgenticChat: (conversationId: string) => UseAgenticChatResult;
}> = ({
  activeConversation,
  conversationId,
  heading,
  loadConversations,
  promptLibrary,
  starterActions,
  useAgenticChat,
}) => {
  const chat = useAgenticChat(conversationId);
  const sendMessage = useCallback(
    async (...args: Parameters<typeof chat.sendMessage>) => {
      await chat.sendMessage(...args);
      await loadConversations();
    },
    [chat, loadConversations],
  );

  return (
    <AgenticChatSurface
      conversationId={conversationId}
      error={chat.error}
      heading={heading}
      isConnected={chat.isConnected}
      isLoading={chat.isLoading}
      isSending={chat.isSending}
      messages={chat.messages}
      onSend={sendMessage}
      promptLibrary={promptLibrary}
      starterActions={starterActions}
      subheading={
        <Stack minWidth={0}>
          <Typography
            color="text.secondary"
            noWrap
            sx={{ maxWidth: { md: 520, xs: '100%' } }}
            variant="body2"
          >
            {activeConversation?.title || conversationId}
          </Typography>
          {workflowLabel(activeConversation) ? (
            <Typography
              color="text.secondary"
              noWrap
              sx={{ maxWidth: { md: 520, xs: '100%' } }}
              variant="caption"
            >
              Workflow: {workflowLabel(activeConversation)}
            </Typography>
          ) : null}
        </Stack>
      }
    />
  );
};

const DeleteConversationDialog: FC<{
  conversation?: AgenticConversationListItem;
  error?: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ conversation, error, isDeleting, onClose, onConfirm }) => {
  const label = conversationLabel(conversation);

  return (
    <Dialog fullWidth maxWidth="xs" onClose={onClose} open={!!conversation}>
      <DialogTitle>Delete Conversation?</DialogTitle>
      <DialogContent>
        <Stack gap={1.5}>
          <DialogContentText>
            This removes the iGENTiC conversation from your chat list. The
            stored conversation is marked deleted and cannot be reopened from
            the UI.
          </DialogContentText>
          {label ? (
            <Typography fontWeight={700} variant="body2">
              {label}
            </Typography>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={isDeleting} onClick={onClose} variant="text">
          Cancel
        </Button>
        <Button disabled={isDeleting} onClick={onConfirm} variant="contained">
          {isDeleting ? <CircularProgress size={18} /> : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

function conversationLabel(
  conversation: AgenticConversationListItem | undefined,
): string {
  return conversation?.title || conversation?.preview || conversation?.id || '';
}

function workflowLabel(
  conversation: AgenticConversationListItem | undefined,
): string | undefined {
  const value = conversation?.metadata?.workflowLabel;
  return typeof value === 'string' && value.trim() ? value : undefined;
}

const BootstrapPanel: FC<{ error?: string }> = ({ error }) => (
  <Stack
    alignItems="center"
    gap={1.5}
    justifyContent="center"
    sx={{ flexGrow: 1, minWidth: 0, p: 2 }}
  >
    {error ? (
      <>
        <Typography color="error" fontWeight={700}>
          Could not open iGENTiC
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ maxWidth: 560, textAlign: 'center' }}
          variant="body2"
        >
          {error}
        </Typography>
      </>
    ) : (
      <>
        <CircularProgress size={22} />
        <Typography color="text.secondary" variant="body2">
          Opening iGENTiC...
        </Typography>
      </>
    )}
  </Stack>
);

const ConversationSidebar: FC<{
  activeConversationId: string;
  conversations: AgenticConversationListItem[];
  isLoading: boolean;
  onDeleteConversation: (conversationId: string) => void;
  onNewChat: () => void;
  onSearchChange: (value: string) => void;
  onSelectConversation: (conversationId: string) => void;
  search: string;
}> = ({
  activeConversationId,
  conversations,
  isLoading,
  onDeleteConversation,
  onNewChat,
  onSearchChange,
  onSelectConversation,
  search,
}) => (
  <Box
    sx={{
      borderRight: 1,
      borderColor: 'divider',
      display: { md: 'flex', xs: 'none' },
      flexDirection: 'column',
      flexShrink: 0,
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      width: 300,
    }}
  >
    <Stack alignItems="center" direction="row" gap={1} sx={{ p: 1.5 }}>
      <Psychology color="primary" fontSize="small" />
      <Typography fontWeight={700} sx={{ flexGrow: 1 }} variant="body1">
        Chats
      </Typography>
      <Tooltip title="New chat">
        <IconButton onClick={onNewChat} size="small">
          <AddOutlined fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
    <Box sx={{ px: 1.5, pb: 1.5 }}>
      <TextField
        fullWidth
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search chats"
        size="small"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
        value={search}
      />
    </Box>
    <Divider />
    <Box
      sx={{
        flexGrow: 1,
        minHeight: 0,
        overscrollBehavior: 'contain',
        overflowY: 'auto',
      }}
    >
      {isLoading && conversations.length === 0 ? (
        <Stack alignItems="center" direction="row" gap={1.5} p={2}>
          <CircularProgress size={18} />
          <Typography color="text.secondary" variant="body2">
            Loading chats...
          </Typography>
        </Stack>
      ) : conversations.length ? (
        <List dense disablePadding>
          {conversations.map((conversation) => (
            <ListItemButton
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id)}
              selected={conversation.id === activeConversationId}
              sx={{ alignItems: 'flex-start', gap: 1, py: 1 }}
            >
              <ChatOutlined color="action" fontSize="small" sx={{ mt: 0.35 }} />
              <ListItemText
                primary={conversation.title || 'Untitled chat'}
                primaryTypographyProps={{
                  fontWeight: 700,
                  noWrap: true,
                  variant: 'body2',
                }}
                secondary={conversation.preview || conversation.id}
                secondaryTypographyProps={{ noWrap: true, variant: 'caption' }}
              />
              <Tooltip title="Delete conversation">
                <IconButton
                  aria-label={`Delete conversation ${conversation.title || conversation.id}`}
                  edge="end"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDeleteConversation(conversation.id);
                  }}
                  size="small"
                >
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </Tooltip>
            </ListItemButton>
          ))}
        </List>
      ) : (
        <Typography color="text.secondary" p={2} variant="body2">
          No chats found.
        </Typography>
      )}
    </Box>
  </Box>
);

async function openInitialConversation({
  createConversation,
  ensureConversation,
  localStorageKey,
  requestedConversationId,
}: {
  createConversation: () => Promise<AgenticConversation>;
  ensureConversation: (input: { id: string }) => Promise<AgenticConversation>;
  localStorageKey: string;
  requestedConversationId: string | undefined;
}): Promise<AgenticConversation> {
  if (requestedConversationId)
    return ensureConversation({ id: requestedConversationId });

  const storedConversationId = localStorage.getItem(localStorageKey);
  if (storedConversationId) {
    try {
      return await ensureConversation({ id: storedConversationId });
    } catch (caught) {
      if (!isAgenticFetchStatus(caught, 404)) throw caught;
      localStorage.removeItem(localStorageKey);
    }
  }

  return createConversation();
}

function upsertConversation(
  items: AgenticConversationListItem[],
  conversation: AgenticConversation,
): AgenticConversationListItem[] {
  const index = items.findIndex((item) => item.id === conversation.id);
  if (index === -1) return [conversation, ...items];
  return items.map((item) =>
    item.id === conversation.id ? { ...item, ...conversation } : item,
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

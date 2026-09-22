import type {
  AgenticMessage,
  AgenticPart,
  AgenticPrompt,
  AgenticRole,
  AgenticToolResultPart,
  JsonObject,
} from '@onivoro/isomorphic-agentic';
import { renderAgenticPrompt } from '@onivoro/isomorphic-agentic';
import { extractAgenticPromptParameters } from '@onivoro/isomorphic-agentic';
import {
  AddOutlined,
  ArrowBackOutlined,
  BuildOutlined,
  CheckCircleOutline,
  ClearOutlined,
  CloseOutlined,
  DeleteOutline,
  EditOutlined,
  ContentCopyOutlined,
  ErrorOutline,
  ExpandMoreOutlined,
  LibraryBooksOutlined,
  Psychology,
  PsychologyOutlined,
  SearchOutlined,
  SendOutlined,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  FC,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {
  AgenticChatResourceContext,
  AgenticPromptLibraryClient,
  AgenticStarterAction,
} from '@onivoro/browser-agentic';
import { resourceContextMetadata } from '@onivoro/browser-agentic';

export interface AgenticChatSurfaceProps {
  conversationId: string;
  error?: string;
  heading?: string;
  isConnected: boolean;
  isLoading: boolean;
  isSending: boolean;
  messages: AgenticMessage[];
  onSend: (text: string, metadata?: JsonObject) => Promise<void>;
  promptLibrary?: AgenticPromptLibraryClient;
  resourceContext?: AgenticChatResourceContext;
  starterActions?: AgenticStarterAction[];
  subheading?: ReactNode;
}

export const AgenticChatSurface: FC<AgenticChatSurfaceProps> = ({
  conversationId,
  error,
  heading = 'iGENTiC',
  isConnected,
  isLoading,
  isSending,
  messages,
  onSend,
  promptLibrary,
  resourceContext,
  starterActions = [],
  subheading,
}) => {
  const [draft, setDraft] = useState('');
  const [draftMetadata, setDraftMetadata] = useState<JsonObject>();
  const [starterInputValues, setStarterInputValues] = useState<
    Record<string, string>
  >({});
  const [promptLibraryOpen, setPromptLibraryOpen] = useState(false);
  const composerRef = useRef<HTMLInputElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const previousConversationIdRef = useRef(conversationId);
  const previousVisibleMessageCountRef = useRef(0);
  const shouldStickToBottomRef = useRef(true);
  const toolResultsByCallId = useMemo(
    () => collectToolResults(messages),
    [messages],
  );
  const visibleMessages = useMemo(
    () => messages.filter((message) => message.role !== 'tool'),
    [messages],
  );

  useEffect(() => {
    const scrollElement = messagesScrollRef.current;
    if (!scrollElement) return;

    const conversationChanged =
      previousConversationIdRef.current !== conversationId;
    const messageCountChanged =
      previousVisibleMessageCountRef.current !== visibleMessages.length;
    const lastMessage = visibleMessages[visibleMessages.length - 1];
    const shouldScrollToBottom =
      conversationChanged ||
      shouldStickToBottomRef.current ||
      (messageCountChanged && lastMessage?.role === 'user');

    previousConversationIdRef.current = conversationId;
    previousVisibleMessageCountRef.current = visibleMessages.length;

    if (!shouldScrollToBottom) return;

    window.requestAnimationFrame(() => {
      scrollElement.scrollTop = scrollElement.scrollHeight;
      shouldStickToBottomRef.current = true;
    });
  }, [conversationId, visibleMessages]);

  const canSend = draft.trim().length > 0 && !isSending;

  const sendText = async (text: string, metadata?: JsonObject) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setDraft('');
    setDraftMetadata(undefined);
    shouldStickToBottomRef.current = true;
    await onSend(trimmed, {
      ...resourceContextMetadata(resourceContext),
      ...metadata,
    });
  };

  const submitMessage = async () => {
    if (canSend) await sendText(draft, draftMetadata);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitMessage();
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          alignItems: { md: 'center', xs: 'stretch' },
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: { md: 'row', xs: 'column' },
          gap: 1.5,
          justifyContent: 'space-between',
          px: { md: 2, xs: 1 },
          py: 1.5,
        }}
      >
        <Stack alignItems="center" direction="row" gap={1.25} minWidth={0}>
          <Psychology color="primary" />
          <Box minWidth={0}>
            <Typography component="h1" fontWeight={700} variant="h5">
              {heading}
            </Typography>
            {subheading ?? (
              <Typography
                color="text.secondary"
                noWrap
                sx={{ maxWidth: { md: 520, xs: '100%' } }}
                variant="body2"
              >
                {conversationId}
              </Typography>
            )}
          </Box>
        </Stack>
        <Stack alignItems="center" direction="row" gap={1}>
          {promptLibrary ? (
            <Tooltip title="Prompt library">
              <IconButton
                aria-label="Open prompt library"
                color="primary"
                onClick={() => setPromptLibraryOpen(true)}
                size="small"
              >
                <LibraryBooksOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
          <Chip
            color={isConnected ? 'success' : 'warning'}
            label={isConnected ? 'Connected' : 'Reconnecting'}
            size="small"
            variant="outlined"
          />
          {isLoading ? <CircularProgress size={18} /> : null}
        </Stack>
      </Box>

      {promptLibrary ? (
        <AgenticPromptLibraryDialog
          onClose={() => setPromptLibraryOpen(false)}
          onInsertPrompt={(prompt, values) => {
            const text = renderAgenticPrompt(prompt, values);
            const hasExistingDraft = !!draft.trim();
            setDraft((current) =>
              current.trim() ? `${current}\n\n${text}` : text,
            );
            setDraftMetadata(
              hasExistingDraft
                ? undefined
                : {
                    promptLibrary: {
                      promptId: prompt.id,
                      title: prompt.title,
                      parameterValues: values,
                    },
                  },
            );
            setPromptLibraryOpen(false);
            window.requestAnimationFrame(() => {
              composerRef.current?.focus();
            });
          }}
          open={promptLibraryOpen}
          promptLibrary={promptLibrary}
        />
      ) : null}

      {error ? (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {error}
        </Alert>
      ) : null}

      <Box
        ref={messagesScrollRef}
        onScroll={(event) => {
          shouldStickToBottomRef.current = isNearScrollBottom(
            event.currentTarget,
          );
        }}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          gap: 1.5,
          minHeight: 0,
          overscrollBehavior: 'contain',
          overflowAnchor: 'none',
          overflowY: 'auto',
          px: { md: 2, xs: 1 },
          py: 2,
        }}
      >
        {isLoading && visibleMessages.length === 0 ? (
          <Stack alignItems="center" direction="row" gap={1.5} p={2}>
            <CircularProgress size={20} />
            <Typography color="text.secondary">
              Loading conversation...
            </Typography>
          </Stack>
        ) : visibleMessages.length === 0 ? (
          <Box
            sx={{
              alignItems: 'center',
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              gap: 1.5,
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <Typography color="text.secondary">
              Start a conversation with iGENTiC.
            </Typography>
            {starterActions.length ? (
              <Stack
                direction={{ md: 'row', xs: 'column' }}
                flexWrap="wrap"
                gap={1}
                justifyContent="center"
                sx={{ maxWidth: 880 }}
              >
                {starterActions.map((action) => (
                  <Paper
                    key={action.label}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      maxWidth: 280,
                      p: 1,
                      width: { md: 260, xs: '100%' },
                    }}
                    variant="outlined"
                  >
                    <Stack gap={1}>
                      <Typography fontWeight={700} variant="body2">
                        {action.label}
                      </Typography>
                      {action.inputs?.map((input) => (
                        <TextField
                          key={input.name}
                          label={input.label}
                          onChange={(event) =>
                            setStarterInputValues((values) => ({
                              ...values,
                              [starterInputKey(action, input.name)]:
                                event.target.value,
                            }))
                          }
                          placeholder={input.placeholder}
                          required={input.required}
                          size="small"
                          value={
                            starterInputValues[
                              starterInputKey(action, input.name)
                            ] ??
                            input.defaultValue ??
                            ''
                          }
                        />
                      ))}
                      <Button
                        disabled={
                          isSending ||
                          !starterInputsValid(action, starterInputValues)
                        }
                        onClick={() =>
                          void sendText(
                            starterPrompt(action, starterInputValues),
                            starterMetadata(action, starterInputValues),
                          )
                        }
                        size="small"
                        variant="outlined"
                      >
                        Start
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : null}
          </Box>
        ) : (
          visibleMessages.map((message) => (
            <AgenticMessageView
              key={message.id}
              message={message}
              toolResultsByCallId={toolResultsByCallId}
            />
          ))
        )}
      </Box>

      <Divider />
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          alignItems: 'flex-end',
          display: 'flex',
          gap: 1,
          px: { md: 2, xs: 1 },
          py: 1.5,
        }}
      >
        <TextField
          disabled={isSending}
          fullWidth
          maxRows={8}
          minRows={2}
          multiline
          inputRef={composerRef}
          onChange={(event) => {
            setDraft(event.target.value);
            setDraftMetadata(undefined);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submitMessage();
            }
          }}
          placeholder="Message iGENTiC"
          size="small"
          value={draft}
        />
        <Tooltip title="Send">
          <span>
            <IconButton
              aria-label="Send message"
              color="primary"
              disabled={!canSend}
              size="large"
              type="submit"
            >
              {isSending ? <CircularProgress size={22} /> : <SendOutlined />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
};

const AgenticPromptLibraryDialog: FC<{
  onClose: () => void;
  onInsertPrompt: (
    prompt: AgenticPrompt,
    values: Record<string, string>,
  ) => void;
  open: boolean;
  promptLibrary: AgenticPromptLibraryClient;
}> = ({ onClose, onInsertPrompt, open, promptLibrary }) => {
  type Mode = 'browse' | 'create' | 'edit';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [prompts, setPrompts] = useState<AgenticPrompt[]>([]);
  const [mode, setMode] = useState<Mode>('browse');
  const [selectedId, setSelectedId] = useState<string>();
  const [editingId, setEditingId] = useState<string>();
  const [title, setTitle] = useState('');
  const [promptText, setPromptText] = useState('');
  const [initialEditor, setInitialEditor] = useState({ prompt: '', title: '' });
  const [values, setValues] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string>();
  const [mutationError, setMutationError] = useState<string>();
  const [search, setSearch] = useState('');
  const [reloadNumber, setReloadNumber] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgenticPrompt>();
  const [deleteError, setDeleteError] = useState<string>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<string>();
  const editingIdRef = useRef<string | undefined>(undefined);
  const pendingTransitionRef = useRef<(() => void) | undefined>(undefined);
  const requestNumberRef = useRef(0);

  const selectedPrompt = prompts.find((prompt) => prompt.id === selectedId);
  const editingPrompt = prompts.find((prompt) => prompt.id === editingId);
  const isEditor = mode === 'create' || mode === 'edit';
  const isDirty =
    isEditor &&
    (title !== initialEditor.title || promptText !== initialEditor.prompt);
  const templateValidation = useMemo(() => {
    if (!promptText.trim()) return { error: undefined, parameters: [] };
    try {
      return {
        error: undefined,
        parameters: extractAgenticPromptParameters(promptText),
      };
    } catch (caught) {
      return { error: errorText(caught), parameters: [] };
    }
  }, [promptText]);
  const canSave =
    !!title.trim() &&
    !!promptText.trim() &&
    !templateValidation.error &&
    isDirty &&
    !isSaving;
  const canInsert =
    !!selectedPrompt &&
    !isLoading &&
    selectedPrompt.parameters.every(
      (parameter) => !parameter.required || !!values[parameter.name]?.trim(),
    );
  const isMutating = isSaving || isDeleting;

  useEffect(() => {
    if (!open) return;
    const requestNumber = ++requestNumberRef.current;
    setIsLoading(true);
    setLoadError(undefined);
    const timeout = window.setTimeout(
      async () => {
        if (requestNumber !== requestNumberRef.current) return;
        try {
          const nextPrompts = await promptLibrary.listPrompts({
            limit: 100,
            search: search.trim() || undefined,
          });
          if (requestNumber !== requestNumberRef.current) return;
          setPrompts(nextPrompts);
          setSelectedId((current) => {
            if (
              !current ||
              nextPrompts.some((prompt) => prompt.id === current)
            ) {
              return current;
            }
            setValues({});
            return undefined;
          });
          const currentEditingId = editingIdRef.current;
          if (
            !search.trim() &&
            currentEditingId &&
            !nextPrompts.some((prompt) => prompt.id === currentEditingId)
          ) {
            editingIdRef.current = undefined;
            setEditingId(undefined);
            setInitialEditor({ prompt: '', title: '' });
            setMode('create');
            setMutationError(
              'The prompt being edited is no longer available. Your changes are preserved as a new prompt.',
            );
          }
        } catch (caught) {
          if (requestNumber === requestNumberRef.current) {
            setLoadError(errorText(caught));
          }
        } finally {
          if (requestNumber === requestNumberRef.current) setIsLoading(false);
        }
      },
      search ? 300 : 0,
    );

    return () => window.clearTimeout(timeout);
  }, [open, promptLibrary, reloadNumber, search]);

  const clearEditor = () => {
    editingIdRef.current = undefined;
    setEditingId(undefined);
    setTitle('');
    setPromptText('');
    setInitialEditor({ prompt: '', title: '' });
  };

  const startCreate = () => {
    setMutationError(undefined);
    clearEditor();
    setMode('create');
  };

  const startEdit = (prompt: AgenticPrompt) => {
    setMutationError(undefined);
    editingIdRef.current = prompt.id;
    setEditingId(prompt.id);
    setTitle(prompt.title);
    setPromptText(prompt.prompt);
    setInitialEditor({ prompt: prompt.prompt, title: prompt.title });
    setMode('edit');
  };

  const requestTransition = (transition: () => void) => {
    if (!isDirty) {
      transition();
      return;
    }
    pendingTransitionRef.current = transition;
    setDiscardOpen(true);
  };

  const resetAndClose = () => {
    setMode('browse');
    setSelectedId(undefined);
    setValues({});
    setSearch('');
    clearEditor();
    onClose();
  };

  const savePrompt = async () => {
    if (!canSave) return;
    requestNumberRef.current += 1;
    setIsLoading(false);
    setMutationError(undefined);
    setIsSaving(true);
    try {
      const saved =
        mode === 'edit' && editingId
          ? await promptLibrary.updatePrompt(editingId, {
              title: title.trim(),
              prompt: promptText.trim(),
            })
          : await promptLibrary.createPrompt({
              title: title.trim(),
              prompt: promptText.trim(),
            });
      setPrompts((current) => {
        const exists = current.some((prompt) => prompt.id === saved.id);
        return exists
          ? current.map((prompt) => (prompt.id === saved.id ? saved : prompt))
          : [saved, ...current];
      });
      setSelectedId(saved.id);
      setValues(
        Object.fromEntries(
          saved.parameters.map((parameter) => [parameter.name, '']),
        ),
      );
      clearEditor();
      setMode('browse');
      setSnackbar(mode === 'edit' ? 'Prompt updated' : 'Prompt created');
    } catch (caught) {
      setMutationError(errorText(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const deletePrompt = async () => {
    if (!deleteTarget) return;
    requestNumberRef.current += 1;
    setIsLoading(false);
    setDeleteError(undefined);
    setIsDeleting(true);
    try {
      await promptLibrary.deletePrompt(deleteTarget.id);
      setPrompts((current) =>
        current.filter((prompt) => prompt.id !== deleteTarget.id),
      );
      if (selectedId === deleteTarget.id) {
        setSelectedId(undefined);
        setValues({});
      }
      if (editingId === deleteTarget.id) {
        clearEditor();
        setMode('browse');
      }
      setSnackbar(`“${deleteTarget.title}” deleted`);
      setDeleteTarget(undefined);
    } catch (caught) {
      setDeleteError(errorText(caught));
    } finally {
      setIsDeleting(false);
    }
  };

  const selectPrompt = (prompt: AgenticPrompt) => {
    requestTransition(() => {
      clearEditor();
      setMode('browse');
      setSelectedId(prompt.id);
      setValues(
        Object.fromEntries(
          prompt.parameters.map((parameter) => [parameter.name, '']),
        ),
      );
    });
  };

  const insertPrompt = () => {
    if (!selectedPrompt || !canInsert) return;
    const prompt = selectedPrompt;
    const parameterValues = values;
    setSelectedId(undefined);
    setValues({});
    setSearch('');
    clearEditor();
    setMode('browse');
    onInsertPrompt(prompt, parameterValues);
  };

  const handleDialogClose = () => requestTransition(resetAndClose);

  const showMobileList = isMobile && mode === 'browse' && !selectedPrompt;
  const showList = !isMobile || showMobileList;
  const showDetail = !isMobile || !showMobileList;

  return (
    <>
      <Dialog
        fullScreen={isMobile}
        fullWidth
        maxWidth="lg"
        onClose={() => (isMutating ? undefined : handleDialogClose())}
        open={open}
        PaperProps={
          isMobile ? undefined : { sx: { height: 'min(760px, 90vh)' } }
        }
      >
        <DialogTitle component="div" sx={{ pb: 1.5 }}>
          <Stack alignItems="center" direction="row" gap={1}>
            {isMobile && !showMobileList ? (
              <Tooltip title="Back to prompts">
                <IconButton
                  aria-label="Back to prompts"
                  disabled={isMutating}
                  onClick={() =>
                    requestTransition(() => {
                      clearEditor();
                      setMode('browse');
                      setSelectedId(undefined);
                      setValues({});
                    })
                  }
                  sx={{ minHeight: 44, minWidth: 44 }}
                >
                  <ArrowBackOutlined />
                </IconButton>
              </Tooltip>
            ) : null}
            <Typography
              component="h2"
              flexGrow={1}
              fontWeight={700}
              variant="h6"
            >
              Prompt Library
            </Typography>
            {(!isMobile || showMobileList) && (
              <>
                {!isMobile ? (
                  <TextField
                    autoFocus
                    disabled={isMutating}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search prompts"
                    size="small"
                    slotProps={{
                      htmlInput: { 'aria-label': 'Search prompts' },
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchOutlined fontSize="small" />
                          </InputAdornment>
                        ),
                        endAdornment: search ? (
                          <InputAdornment position="end">
                            <Tooltip title="Clear search">
                              <IconButton
                                aria-label="Clear prompt search"
                                edge="end"
                                onClick={() => setSearch('')}
                                size="small"
                                sx={{ minHeight: 44, minWidth: 44 }}
                              >
                                <ClearOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </InputAdornment>
                        ) : undefined,
                      },
                    }}
                    sx={{ width: 240 }}
                    value={search}
                  />
                ) : null}
                <Button
                  disabled={isMutating}
                  onClick={() => requestTransition(startCreate)}
                  startIcon={<AddOutlined />}
                  sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
                  variant="contained"
                >
                  New prompt
                </Button>
              </>
            )}
            <Tooltip title="Close prompt library">
              <IconButton
                aria-label="Close prompt library"
                disabled={isMutating}
                onClick={handleDialogClose}
                sx={{ minHeight: 44, minWidth: 44 }}
              >
                <CloseOutlined />
              </IconButton>
            </Tooltip>
          </Stack>
          {showMobileList ? (
            <TextField
              disabled={isMutating}
              fullWidth
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search prompts"
              size="small"
              slotProps={{
                htmlInput: { 'aria-label': 'Search prompts' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlined fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: search ? (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="Clear prompt search"
                        edge="end"
                        onClick={() => setSearch('')}
                        sx={{ minHeight: 44, minWidth: 44 }}
                      >
                        <ClearOutlined />
                      </IconButton>
                    </InputAdornment>
                  ) : undefined,
                },
              }}
              value={search}
            />
          ) : null}
        </DialogTitle>

        <DialogContent
          aria-busy={isLoading}
          dividers
          sx={{ display: 'flex', minHeight: 0, p: 0 }}
        >
          <Stack width="100%">
            {loadError ? (
              <Alert
                action={
                  <Button
                    onClick={() => setReloadNumber((current) => current + 1)}
                    sx={{ minHeight: 44 }}
                  >
                    Retry
                  </Button>
                }
                severity="error"
                sx={{ borderRadius: 0 }}
              >
                {prompts.length
                  ? `Showing cached prompts. ${loadError}`
                  : loadError}
              </Alert>
            ) : null}
            {isLoading && prompts.length ? (
              <LinearProgress aria-label="Refreshing prompts" />
            ) : null}
            <Stack direction="row" flexGrow={1} minHeight={0}>
              {showList ? (
                <Box
                  sx={{
                    borderRight: { sm: 1 },
                    borderColor: 'divider',
                    minWidth: 0,
                    overflowY: 'auto',
                    width: { sm: 340, xs: '100%' },
                  }}
                >
                  {isLoading && !prompts.length ? (
                    <Stack gap={1} p={2}>
                      {[1, 2, 3, 4].map((item) => (
                        <Skeleton key={item} height={68} variant="rounded" />
                      ))}
                    </Stack>
                  ) : prompts.length ? (
                    <List disablePadding>
                      {prompts.map((prompt) => (
                        <ListItem key={prompt.id} divider disablePadding>
                          <Button
                            aria-current={selectedId === prompt.id || undefined}
                            disabled={isMutating || isLoading}
                            onClick={() => selectPrompt(prompt)}
                            sx={{
                              flexGrow: 1,
                              justifyContent: 'flex-start',
                              minHeight: 72,
                              minWidth: 0,
                              px: 2,
                              textAlign: 'left',
                              textTransform: 'none',
                            }}
                          >
                            <ListItemText
                              primary={
                                <Typography fontWeight={700} variant="body1">
                                  {prompt.title}
                                </Typography>
                              }
                              secondary={
                                <>
                                  <Typography
                                    component="span"
                                    display="block"
                                    noWrap
                                    variant="body2"
                                  >
                                    {prompt.prompt}
                                  </Typography>
                                  <Typography
                                    component="span"
                                    display="block"
                                    variant="caption"
                                  >
                                    {parameterCountText(
                                      prompt.parameters.length,
                                    )}
                                  </Typography>
                                </>
                              }
                              sx={{ minWidth: 0 }}
                            />
                          </Button>
                          <Stack
                            alignItems="center"
                            direction="row"
                            flexShrink={0}
                            pr={1}
                          >
                            <Tooltip title={`Edit ${prompt.title}`}>
                              <IconButton
                                aria-label={`Edit ${prompt.title}`}
                                disabled={
                                  isMutating || isLoading || !!loadError
                                }
                                onClick={() =>
                                  requestTransition(() => startEdit(prompt))
                                }
                                sx={{ minHeight: 44, minWidth: 44 }}
                              >
                                <EditOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={`Delete ${prompt.title}`}>
                              <IconButton
                                aria-label={`Delete ${prompt.title}`}
                                disabled={
                                  isMutating || isLoading || !!loadError
                                }
                                onClick={() =>
                                  requestTransition(() => {
                                    clearEditor();
                                    setMode('browse');
                                    setDeleteError(undefined);
                                    setDeleteTarget(prompt);
                                  })
                                }
                                sx={{ minHeight: 44, minWidth: 44 }}
                              >
                                <DeleteOutline fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Stack
                      alignItems="center"
                      gap={1.5}
                      p={4}
                      textAlign="center"
                    >
                      <LibraryBooksOutlined color="disabled" />
                      <Typography fontWeight={700}>
                        {search ? 'No prompts found' : 'No saved prompts yet'}
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        {search
                          ? 'Try another search or clear your search.'
                          : 'Save reusable instructions for your conversations.'}
                      </Typography>
                      {search ? (
                        <Button
                          onClick={() => setSearch('')}
                          sx={{ minHeight: 44 }}
                        >
                          Clear search
                        </Button>
                      ) : (
                        <Button
                          onClick={() => requestTransition(startCreate)}
                          sx={{ minHeight: 44 }}
                          variant="contained"
                        >
                          Create your first prompt
                        </Button>
                      )}
                    </Stack>
                  )}
                </Box>
              ) : null}

              {showDetail ? (
                <Box
                  flexGrow={1}
                  minWidth={0}
                  overflow="auto"
                  p={{ sm: 3, xs: 2 }}
                >
                  {isEditor ? (
                    <Stack gap={2}>
                      <Typography component="h3" fontWeight={700} variant="h6">
                        {mode === 'edit' ? 'Edit prompt' : 'Create prompt'}
                      </Typography>
                      {mode === 'edit' && !editingPrompt ? (
                        <Alert severity="warning">
                          This prompt is no longer in the current results. Your
                          changes are preserved.
                        </Alert>
                      ) : null}
                      {mutationError ? (
                        <Alert severity="error">{mutationError}</Alert>
                      ) : null}
                      <TextField
                        autoFocus
                        disabled={isSaving}
                        error={title.length > 0 && !title.trim()}
                        fullWidth
                        helperText={
                          title.length > 0 && !title.trim()
                            ? 'Title cannot be only whitespace.'
                            : 'Give this prompt a recognizable name.'
                        }
                        label="Title"
                        onChange={(event) => setTitle(event.target.value)}
                        required
                        value={title}
                      />
                      <TextField
                        disabled={isSaving}
                        error={
                          !!templateValidation.error ||
                          (promptText.length > 0 && !promptText.trim())
                        }
                        fullWidth
                        helperText={
                          templateValidation.error ??
                          (promptText.length > 0 && !promptText.trim()
                            ? 'Prompt cannot be only whitespace.'
                            : 'Use {{parameterName}} for values to fill in later.')
                        }
                        label="Prompt template"
                        minRows={isMobile ? 12 : 16}
                        multiline
                        onChange={(event) => setPromptText(event.target.value)}
                        required
                        sx={{ '& textarea': { resize: 'vertical' } }}
                        value={promptText}
                      />
                      <Box>
                        <Typography
                          fontWeight={700}
                          gutterBottom
                          variant="body2"
                        >
                          Parameters
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={1}>
                          {templateValidation.parameters.length ? (
                            templateValidation.parameters.map((parameter) => (
                              <Chip
                                key={parameter.name}
                                label={parameter.label}
                                size="small"
                              />
                            ))
                          ) : (
                            <Typography color="text.secondary" variant="body2">
                              No parameters detected.
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                  ) : selectedPrompt ? (
                    <Stack gap={2}>
                      <Box>
                        <Typography
                          component="h3"
                          fontWeight={700}
                          variant="h6"
                        >
                          {selectedPrompt.title}
                        </Typography>
                        <Typography color="text.secondary" variant="body2">
                          {parameterCountText(selectedPrompt.parameters.length)}
                        </Typography>
                      </Box>
                      {selectedPrompt.parameters.length ? (
                        selectedPrompt.parameters.map((parameter, index) => (
                          <TextField
                            key={parameter.name}
                            autoFocus={index === 0}
                            disabled={isLoading}
                            fullWidth
                            label={parameter.label}
                            onChange={(event) =>
                              setValues((current) => ({
                                ...current,
                                [parameter.name]: event.target.value,
                              }))
                            }
                            required={parameter.required}
                            value={values[parameter.name] ?? ''}
                          />
                        ))
                      ) : (
                        <Typography color="text.secondary" variant="body2">
                          This prompt is ready to insert as written.
                        </Typography>
                      )}
                      <PromptPreview
                        text={promptPreview(selectedPrompt, values)}
                      />
                    </Stack>
                  ) : (
                    <Stack
                      alignItems="center"
                      height="100%"
                      justifyContent="center"
                      textAlign="center"
                    >
                      <LibraryBooksOutlined color="disabled" />
                      <Typography fontWeight={700} mt={1}>
                        Select a prompt
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        Choose a saved prompt to preview and fill in its
                        parameters.
                      </Typography>
                    </Stack>
                  )}
                </Box>
              ) : null}
            </Stack>
          </Stack>
        </DialogContent>

        {isEditor || selectedPrompt ? (
          <DialogActions
            sx={{ '& > button': { minHeight: 44 }, minHeight: 64, px: 2 }}
          >
            {isEditor ? (
              <>
                <Button
                  disabled={isSaving}
                  onClick={() =>
                    requestTransition(() => {
                      clearEditor();
                      setMode('browse');
                    })
                  }
                >
                  Cancel
                </Button>
                <Button
                  disabled={!canSave}
                  onClick={() => void savePrompt()}
                  variant="contained"
                >
                  {isSaving ? 'Saving…' : 'Save prompt'}
                </Button>
              </>
            ) : selectedPrompt ? (
              <Button
                disabled={!canInsert}
                onClick={insertPrompt}
                variant="contained"
              >
                Insert into message
              </Button>
            ) : null}
          </DialogActions>
        ) : null}
      </Dialog>

      <Dialog
        aria-labelledby="discard-prompt-changes-title"
        onClose={() => setDiscardOpen(false)}
        open={discardOpen}
      >
        <DialogTitle id="discard-prompt-changes-title">
          Discard unsaved changes?
        </DialogTitle>
        <DialogContent>
          <Typography>Your prompt changes have not been saved.</Typography>
        </DialogContent>
        <DialogActions sx={{ '& > button': { minHeight: 44 } }}>
          <Button autoFocus onClick={() => setDiscardOpen(false)}>
            Keep editing
          </Button>
          <Button
            onClick={() => {
              setDiscardOpen(false);
              const transition = pendingTransitionRef.current;
              pendingTransitionRef.current = undefined;
              transition?.();
            }}
          >
            Discard changes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        aria-labelledby="delete-prompt-title"
        onClose={() => {
          if (isDeleting) return;
          setDeleteError(undefined);
          setDeleteTarget(undefined);
        }}
        open={!!deleteTarget}
      >
        <DialogTitle id="delete-prompt-title">
          Delete “{deleteTarget?.title}”?
        </DialogTitle>
        <DialogContent>
          <Stack gap={2}>
            {deleteError ? <Alert severity="error">{deleteError}</Alert> : null}
            <Typography>
              This saved prompt will be permanently deleted.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ '& > button': { minHeight: 44 } }}>
          <Button
            autoFocus
            disabled={isDeleting}
            onClick={() => {
              setDeleteError(undefined);
              setDeleteTarget(undefined);
            }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            disabled={isDeleting}
            onClick={() => void deletePrompt()}
          >
            {isDeleting ? 'Deleting…' : 'Delete prompt'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        autoHideDuration={4000}
        message={snackbar}
        onClose={() => setSnackbar(undefined)}
        open={!!snackbar}
      />
    </>
  );
};

const PromptPreview: FC<{ text: string }> = ({ text }) => (
  <Paper sx={{ p: 2 }} variant="outlined">
    <Typography fontWeight={700} gutterBottom variant="body2">
      Preview
    </Typography>
    <Typography
      color="text.secondary"
      sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
      variant="body2"
    >
      {text.trim() || 'Your prompt preview will appear here.'}
    </Typography>
  </Paper>
);

function promptPreview(
  prompt: AgenticPrompt,
  values: Record<string, string>,
): string {
  return prompt.prompt.replace(/{{\s*([^{}]*?)\s*}}/g, (_match, name) => {
    const parameter = prompt.parameters.find(
      (candidate) => candidate.name === String(name).trim(),
    );
    return (
      values[parameter?.name ?? '']?.trim() || `[${parameter?.label ?? name}]`
    );
  });
}

function parameterCountText(count: number): string {
  if (count === 0) return 'No parameters';
  return `${count} ${count === 1 ? 'parameter' : 'parameters'}`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function starterInputKey(
  action: AgenticStarterAction,
  inputName: string,
): string {
  return `${action.label}:${inputName}`;
}

function starterInputs(
  action: AgenticStarterAction,
  values: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    (action.inputs ?? []).map((input) => [
      input.name,
      (
        values[starterInputKey(action, input.name)] ??
        input.defaultValue ??
        ''
      ).trim(),
    ]),
  );
}

function starterInputsValid(
  action: AgenticStarterAction,
  values: Record<string, string>,
): boolean {
  const resolved = starterInputs(action, values);
  return (action.inputs ?? []).every(
    (input) => !input.required || !!resolved[input.name],
  );
}

function starterPrompt(
  action: AgenticStarterAction,
  values: Record<string, string>,
): string {
  const inputs = starterInputs(action, values);
  const populatedInputs = Object.entries(inputs).filter(([, value]) => value);
  if (!populatedInputs.length) return action.prompt;

  return `${action.prompt}\n\nWorkflow inputs:\n${populatedInputs
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n')}`;
}

function starterMetadata(
  action: AgenticStarterAction,
  values: Record<string, string>,
): JsonObject | undefined {
  const inputs = starterInputs(action, values);
  return { ...action.metadata, workflowInputs: inputs };
}

const AgenticMessageView: FC<{
  message: AgenticMessage;
  toolResultsByCallId: Map<string, AgenticToolResultPart>;
}> = ({ message, toolResultsByCallId }) => {
  const isUser = message.role === 'user';
  const parts = useMemo(() => message.parts ?? [], [message.parts]);
  const defaultParts = useMemo(
    () =>
      parts.filter(
        (part) => part.type !== 'tool-call' && part.type !== 'tool-result',
      ),
    [parts],
  );
  const toolParts = useMemo(
    () =>
      parts.filter(
        (part) => part.type === 'tool-call' || part.type === 'tool-result',
      ),
    [parts],
  );
  const [toolCallsExpanded, setToolCallsExpanded] = useState(false);
  const timestamp = formatTimestamp(message.createdAt);

  return (
    <Paper
      elevation={0}
      sx={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        bgcolor: isUser ? 'primary.main' : 'background.paper',
        border: isUser ? 0 : 1,
        borderColor: 'divider',
        borderRadius: 2,
        color: isUser ? 'primary.contrastText' : 'text.primary',
        flexShrink: 0,
        maxWidth: { md: '78%', xs: '100%' },
        minWidth: { sm: 280, xs: 0 },
        overflow: 'hidden',
      }}
    >
      <Stack gap={1} sx={{ p: 1.5 }}>
        <Stack
          alignItems="center"
          direction="row"
          gap={1}
          justifyContent="space-between"
        >
          <Stack alignItems="center" direction="row" gap={0.75}>
            {roleIcon(message.role)}
            <Typography fontWeight={700} variant="body2">
              {roleLabel(message.role)}
            </Typography>
          </Stack>
          <Stack alignItems="center" direction="row" gap={1}>
            {timestamp ? (
              <Typography
                color={isUser ? 'inherit' : 'text.secondary'}
                variant="caption"
              >
                {timestamp}
              </Typography>
            ) : null}
            <Chip
              color={message.status === 'error' ? 'error' : 'default'}
              label={message.status}
              size="small"
              variant={isUser ? 'filled' : 'outlined'}
            />
          </Stack>
        </Stack>
        {defaultParts.length ? (
          <Stack gap={1}>
            {defaultParts.map((part) =>
              renderPart(part, isUser, toolResultsByCallId),
            )}
          </Stack>
        ) : message.status === 'pending' || message.status === 'streaming' ? (
          <Stack alignItems="center" direction="row" gap={1}>
            <CircularProgress color="inherit" size={14} />
            <Typography variant="body2">Thinking...</Typography>
          </Stack>
        ) : toolParts.length ? null : (
          <Typography color="text.secondary" variant="body2">
            No response content.
          </Typography>
        )}
        {toolParts.length ? (
          <Accordion
            disableGutters
            elevation={0}
            expanded={toolCallsExpanded}
            onChange={(_, expanded) => setToolCallsExpanded(expanded)}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              '&:before': { display: 'none' },
            }}
            variant="outlined"
          >
            <AccordionSummary
              expandIcon={<ExpandMoreOutlined fontSize="small" />}
              sx={{
                minHeight: 38,
                '& .MuiAccordionSummary-content': {
                  alignItems: 'center',
                  gap: 1,
                  my: 0.75,
                },
              }}
            >
              <BuildOutlined fontSize="small" />
              <Typography fontWeight={700} variant="body2">
                {toolCallsExpanded ? 'Hide' : 'Show'} tool calls (
                {toolParts.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails
              sx={{ borderTop: 1, borderColor: 'divider', p: 1 }}
            >
              {toolCallsExpanded ? (
                <Stack gap={1}>
                  {toolParts.map((part) =>
                    renderPart(part, isUser, toolResultsByCallId),
                  )}
                </Stack>
              ) : null}
            </AccordionDetails>
          </Accordion>
        ) : null}
      </Stack>
    </Paper>
  );
};

function renderPart(
  part: AgenticPart,
  isUser: boolean,
  toolResultsByCallId: Map<string, AgenticToolResultPart>,
) {
  if (part.type === 'text' || part.type === 'summary') {
    return isUser ? (
      <Typography
        key={part.id}
        sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
        variant="body1"
      >
        {part.text}
      </Typography>
    ) : (
      <AgenticMarkdown key={part.id} text={part.text} />
    );
  }

  if (part.type === 'reasoning') {
    return (
      <Box key={part.id} sx={{ borderLeft: 2, borderColor: 'divider', pl: 1 }}>
        <Typography
          color={isUser ? 'inherit' : 'text.secondary'}
          sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
          variant="body2"
        >
          {part.text}
        </Typography>
      </Box>
    );
  }

  if (part.type === 'tool-call') {
    return (
      <ToolActivity
        key={part.id}
        input={part.input ?? part.inputText}
        name={part.name}
        result={toolResultsByCallId.get(part.toolCallId)}
        status={part.status ?? 'pending'}
      />
    );
  }

  if (part.type === 'tool-result') {
    return (
      <ToolActivity
        key={part.id}
        name={part.name}
        result={part}
        status={part.status ?? (part.isError ? 'error' : 'complete')}
      />
    );
  }

  if (part.type === 'error') {
    return (
      <Alert key={part.id} severity="error" sx={{ borderRadius: 1 }}>
        {part.message}
      </Alert>
    );
  }

  if (part.type === 'file') {
    return (
      <Typography
        key={part.id}
        sx={{ overflowWrap: 'anywhere' }}
        variant="body2"
      >
        {part.name}
      </Typography>
    );
  }

  return (
    <Typography key={part.id} sx={{ overflowWrap: 'anywhere' }} variant="body2">
      {formatPayload(part)}
    </Typography>
  );
}

const AgenticMarkdown: FC<{ text: string }> = ({ text }) => {
  const parsedJson = parseJsonString(text);
  if (parsedJson !== text)
    return <PayloadBlock label="JSON" value={parsedJson} />;

  return (
    <Box
      sx={{
        '& > :first-of-type': { mt: 0 },
        '& > :last-child': { mb: 0 },
        '& code': {
          bgcolor: 'action.hover',
          borderRadius: 0.5,
          fontFamily: 'monospace',
          fontSize: '0.9em',
          px: 0.5,
        },
        '& pre': {
          bgcolor: 'action.hover',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'auto',
          p: 1,
        },
        '& pre code': { bgcolor: 'transparent', p: 0 },
        '& table': {
          borderCollapse: 'collapse',
          display: 'block',
          my: 1,
          overflowX: 'auto',
          width: '100%',
        },
        '& td, & th': {
          border: 1,
          borderColor: 'divider',
          px: 1,
          py: 0.75,
          textAlign: 'left',
          verticalAlign: 'top',
        },
        '& th': { bgcolor: 'action.hover', fontWeight: 700 },
        overflowWrap: 'anywhere',
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </Box>
  );
};

const ToolActivity: FC<{
  input?: unknown;
  name: string;
  result?: AgenticToolResultPart;
  status: string;
}> = ({ input, name, result, status }) => {
  const [expanded, setExpanded] = useState(false);
  const isError = !!result?.isError || status === 'error';
  const resultValue = result?.result ?? result?.resultText;

  return (
    <Box
      sx={{
        bgcolor: 'action.hover',
        border: 1,
        borderColor: isError ? 'error.main' : 'divider',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <Stack
        alignItems="center"
        component="button"
        direction="row"
        gap={1}
        onClick={() => setExpanded((value) => !value)}
        sx={{
          bgcolor: 'transparent',
          border: 0,
          color: 'inherit',
          cursor: 'pointer',
          font: 'inherit',
          px: 1,
          py: 0.75,
          textAlign: 'left',
          width: '100%',
        }}
      >
        {isError ? (
          <ErrorOutline color="error" fontSize="small" />
        ) : result ? (
          <CheckCircleOutline color="success" fontSize="small" />
        ) : (
          <BuildOutlined fontSize="small" />
        )}
        <Typography fontWeight={700} sx={{ flexGrow: 1 }} variant="body2">
          {name}
        </Typography>
        <Typography color="text.secondary" noWrap variant="caption">
          {toolSummary(resultValue)}
        </Typography>
        <Chip
          color={isError ? 'error' : 'default'}
          label={result?.status ?? status}
          size="small"
          variant="outlined"
        />
        <ExpandMoreOutlined
          fontSize="small"
          sx={{
            transform: expanded ? 'rotate(180deg)' : undefined,
            transition: 'transform 120ms ease',
          }}
        />
      </Stack>
      <Collapse in={expanded}>
        <Stack gap={1} sx={{ borderTop: 1, borderColor: 'divider', p: 1 }}>
          {input !== undefined ? (
            <PayloadBlock label="Arguments" value={input} />
          ) : null}
          {result ? (
            <PayloadBlock
              label={isError ? 'Error' : 'Result'}
              value={resultValue}
            />
          ) : null}
        </Stack>
      </Collapse>
    </Box>
  );
};

const PayloadBlock: FC<{ label: string; value: unknown }> = ({
  label,
  value,
}) => {
  const formatted = formatPayload(parseJsonString(value));
  return (
    <Box>
      <Stack alignItems="center" direction="row" justifyContent="space-between">
        <Typography color="text.secondary" fontWeight={700} variant="caption">
          {label}
        </Typography>
        <Tooltip title="Copy">
          <IconButton
            onClick={() => void navigator.clipboard?.writeText(formatted ?? '')}
            size="small"
          >
            <ContentCopyOutlined fontSize="inherit" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box
        component="pre"
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          fontFamily: 'monospace',
          fontSize: 12,
          m: 0,
          maxHeight: 260,
          overflow: 'auto',
          p: 1,
          whiteSpace: 'pre-wrap',
        }}
      >
        {formatted}
      </Box>
    </Box>
  );
};

function collectToolResults(
  messages: AgenticMessage[],
): Map<string, AgenticToolResultPart> {
  const results = new Map<string, AgenticToolResultPart>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === 'tool-result') results.set(part.toolCallId, part);
    }
  }
  return results;
}

function roleIcon(role: AgenticRole) {
  if (role === 'assistant') return <Psychology fontSize="small" />;
  if (role === 'summary') return <PsychologyOutlined fontSize="small" />;
  return null;
}

function roleLabel(role: AgenticRole): string {
  switch (role) {
    case 'assistant':
      return 'iGENTiC';
    case 'summary':
      return 'Summary';
    case 'system':
      return 'System';
    default:
      return 'You';
  }
}

function formatPayload(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseJsonString(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || !['{', '['].includes(trimmed[0])) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function formatTimestamp(value: string | undefined): string {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function isNearScrollBottom(element: HTMLElement): boolean {
  const distanceFromBottom =
    element.scrollHeight - element.scrollTop - element.clientHeight;
  return distanceFromBottom < 96;
}

function toolSummary(value: unknown): string {
  const parsed = parseJsonString(value);
  if (Array.isArray(parsed)) return `${parsed.length} records`;
  if (parsed && typeof parsed === 'object')
    return `${Object.keys(parsed).length} fields`;
  if (typeof parsed === 'string' && parsed.trim())
    return parsed.trim().slice(0, 80);
  return '';
}

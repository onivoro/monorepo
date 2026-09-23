import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { FC, ReactNode, useCallback, useEffect, useState } from 'react';

export interface McpToolCatalogPageShellProps {
  iframeTitle?: string;
  loadHtml: () => Promise<string>;
  loadingLabel?: string;
  pageShell?: (children: ReactNode) => ReactNode;
}

export const McpToolCatalogPageShell: FC<McpToolCatalogPageShellProps> = ({
  iframeTitle = 'MCP tool catalog',
  loadHtml,
  loadingLabel = 'Loading MCP tool catalog...',
  pageShell,
}) => {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadToolsCatalog() {
      setError('');

      try {
        const content = await loadHtml();
        if (active) setHtml(content);
      } catch (caught) {
        if (active)
          setError(caught instanceof Error ? caught.message : String(caught));
      }
    }

    void loadToolsCatalog();

    return () => {
      active = false;
    };
  }, [loadHtml]);

  const content = error ? (
    <Box sx={{ p: 3 }}>
      <Typography color="error" variant="h6">
        Unable to load MCP tool catalog
      </Typography>
      <Typography color="text.secondary">{error}</Typography>
    </Box>
  ) : html ? (
    <Box
      sx={{
        flexGrow: 1,
        height: { sm: 'calc(100dvh - 96px)', xs: 'calc(100dvh - 80px)' },
        minHeight: 0,
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
        width: '100%',
      }}
    >
      <Box
        component="iframe"
        scrolling="yes"
        srcDoc={html}
        title={iframeTitle}
        sx={{
          border: 0,
          display: 'block',
          height: '100%',
          minHeight: 0,
          width: '100%',
        }}
      />
    </Box>
  ) : (
    <Box sx={{ alignItems: 'center', display: 'flex', gap: 2, p: 3 }}>
      <CircularProgress size={24} />
      <Typography color="text.secondary">{loadingLabel}</Typography>
    </Box>
  );

  return <>{pageShell ? pageShell(content) : content}</>;
};

export interface McpToolCatalogFetchPageProps {
  endpoint: string;
  errorLabel: string;
  fetchOptions?: RequestInit;
  iframeTitle?: string;
  loadingLabel?: string;
  pageShell?: (children: ReactNode) => ReactNode;
}

export const McpToolCatalogFetchPage: FC<McpToolCatalogFetchPageProps> = ({
  endpoint,
  errorLabel,
  fetchOptions,
  iframeTitle,
  loadingLabel,
  pageShell,
}) => {
  const loadHtml = useCallback(async () => {
    const response = await fetch(endpoint, fetchOptions);

    if (!response.ok) {
      throw new Error(`${errorLabel}: ${response.status}`);
    }

    const { value } = await response.json();
    return value;
  }, [endpoint, errorLabel, fetchOptions]);

  return (
    <McpToolCatalogPageShell
      iframeTitle={iframeTitle}
      loadHtml={loadHtml}
      loadingLabel={loadingLabel}
      pageShell={pageShell}
    />
  );
};

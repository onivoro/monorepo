/**
 * Mapping from ivux CSS variable names to VSCode CSS variable names.
 * This defines how VSCode's theme colors should be applied to ivux components.
 *
 * VSCode exposes theme colors as CSS variables with the `--vscode-` prefix.
 * All variable names below have been validated against actual VSCode theme colors.
 * @see https://code.visualstudio.com/api/references/theme-color
 */
const ivuxToVscodeMapping: Record<string, string> = {
  // Backgrounds
  '--ivux-background': '--vscode-sideBar-background',
  '--ivux-background-paper': '--vscode-editor-background',
  '--ivux-card-background': '--vscode-editor-background',
  '--ivux-popover-background': '--vscode-editorWidget-background',

  // Foregrounds
  '--ivux-foreground': '--vscode-foreground',
  '--ivux-card-foreground': '--vscode-editor-foreground',
  '--ivux-popover-foreground': '--vscode-editorWidget-foreground',

  // Primary - use button colors
  '--ivux-primary': '--vscode-button-background',
  '--ivux-primary-foreground': '--vscode-button-foreground',

  // Secondary - use secondary button colors
  '--ivux-secondary': '--vscode-button-secondaryBackground',
  '--ivux-secondary-foreground': '--vscode-button-secondaryForeground',

  // Muted - use description foreground and list hover
  '--ivux-muted': '--vscode-list-hoverBackground',
  '--ivux-muted-foreground': '--vscode-descriptionForeground',

  // Accent - use focus/selection colors
  '--ivux-accent': '--vscode-list-activeSelectionBackground',
  '--ivux-accent-foreground': '--vscode-list-activeSelectionForeground',
  '--ivux-accent-background': '--vscode-list-inactiveSelectionBackground',

  // Borders & Inputs
  '--ivux-border': '--vscode-panel-border',
  '--ivux-input': '--vscode-input-background',
  '--ivux-input-border': '--vscode-focusBorder',
  '--ivux-ring': '--vscode-focusBorder',
  '--ivux-table-hover': '--vscode-list-hoverBackground',

  // Status colors
  '--ivux-error': '--vscode-errorForeground',
  '--ivux-info': '--vscode-focusBorder',

  // Utility colors
  '--ivux-scrollbar': '--vscode-scrollbarSlider-background',
  '--ivux-scrollbar-hover': '--vscode-scrollbarSlider-hoverBackground',
};

/**
 * Generates a CSS stylesheet that maps VSCode CSS variables to ivux CSS variables.
 * Uses !important to override ivux default values that are also set on :root.
 */
function generateVscodeThemeBridgeStylesheet(): string {
  const mappings = Object.entries(ivuxToVscodeMapping)
    .map(
      ([ivuxVar, vscodeVar]) => `  ${ivuxVar}: var(${vscodeVar}) !important;`,
    )
    .join('\n');

  return `
/* VSCode Theme Bridge - Maps VSCode theme colors to ivux CSS variables */
/* Uses !important to override ivux default values */
:root,
html,
body,
[data-theme="light"],
[data-theme="dark"] {
${mappings}
}
`.trim();
}

/**
 * Generate scripts that enable VSCode theme integration for ivux components.
 *
 * This includes:
 * 1. Theme detection script that reads VSCode's body class and sets data-theme attribute
 * 2. CSS stylesheet that maps VSCode CSS variables to ivux CSS variables
 * 3. MutationObserver to handle theme changes
 *
 * @param nonce - CSP nonce for the script tags
 * @returns HTML string containing script and style tags for VSCode theme bridge
 *
 * @example
 * ```typescript
 * class MyWebviewProvider extends BaseWebviewProvider {
 *   protected getInjectedScripts(nonce: string): string {
 *     return generateVscodeThemeBridgeInjection(nonce);
 *   }
 * }
 * ```
 */
export function generateVscodeThemeBridgeInjection(nonce: string): string {
  const bridgeStylesheet = generateVscodeThemeBridgeStylesheet();

  return `
<script nonce="${nonce}">
(function() {
  // Detect VSCode theme from body class
  function detectVscodeTheme() {
    const body = document.body;
    if (body.classList.contains('vscode-dark') || body.classList.contains('vscode-high-contrast')) {
      return 'dark';
    }
    return 'light';
  }

  // Set initial theme
  function setTheme() {
    const theme = detectVscodeTheme();
    document.documentElement.setAttribute('data-theme', theme);
    // Store in window for React to access
    window.__VSCODE_THEME__ = theme;
  }

  // Initial detection
  if (document.body) {
    setTheme();
  } else {
    document.addEventListener('DOMContentLoaded', setTheme);
  }

  // Observe body class changes for theme switches
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.attributeName === 'class') {
        setTheme();
        // Dispatch custom event for React to listen to
        window.dispatchEvent(new CustomEvent('vscode-theme-change', {
          detail: { theme: detectVscodeTheme() }
        }));
      }
    });
  });

  function startObserving() {
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.body) {
    startObserving();
  } else {
    document.addEventListener('DOMContentLoaded', startObserving);
  }
})();
</script>
<script nonce="${nonce}">
(function() {
  const style = document.createElement('style');
  style.id = 'vscode-theme-bridge';
  style.textContent = ${JSON.stringify(generateVscodeThemeBridgeStylesheet())};
  document.head.appendChild(style);
})();
</script>
`;
}

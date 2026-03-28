/**
 * Generate the VSCode API bridge script that makes the VSCode API available to webview content.
 * This script creates a global `window.vscodeApi` object with postMessage, setState, and getState methods.
 */
export function generateVscodeApiBridgeScript(nonce: string): string {
  return `
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();

      // Make vscode API available globally for the React app
      window.vscodeApi = {
        postMessage: (message) => vscode.postMessage(message),
        setState: (state) => vscode.setState(state),
        getState: () => vscode.getState(),
      };

      // Listen for messages from the extension
      window.addEventListener('message', (event) => {
        const message = event.data;
        // Dispatch custom event for React app to listen to
        window.dispatchEvent(new CustomEvent('vscode-message', { detail: message }));
      });
    </script>
  `;
}

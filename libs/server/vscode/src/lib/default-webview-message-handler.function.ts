import { StdioServerProcess } from '@onivoro/server-stdio';
import { BaseWebviewProvider } from './classes/base-webview-provider';
import { JsonRpcRequest } from '@onivoro/isomorphic-jsonrpc';

/**
 * Default webview message handler that bridges messages to the stdio server.
 */
export async function defaultWebviewMessageHandler(
  message: JsonRpcRequest,
  context: {
    serverProcess: StdioServerProcess;
    webviewProvider: BaseWebviewProvider;
  },
): Promise<void> {
  if (message.method) {
    try {
      const result = await context.serverProcess.sendRequest(
        message.method,
        message.params,
      );
      context.webviewProvider.postMessage({
        id: message.id,
        result,
      });
    } catch (error) {
      context.webviewProvider.postMessage({
        id: message.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

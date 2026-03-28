import { OutputChannel } from 'vscode';

export function logDebug(
  outputChannel: OutputChannel,
  message: string,
  ...args: any[]
) {
  const timestamp = new Date().toISOString();
  outputChannel.appendLine(`[DEBUG ${timestamp}] ${message}`);
  if (args.length > 0) {
    args.forEach((arg) => {
      outputChannel.appendLine(JSON.stringify(arg, null, 2));
    });
  }
}

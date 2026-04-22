import type { PromptObject } from 'prompts';
import type { Transport } from './types';

export function buildPrompts(defaults: {
  projectName: string;
  transport: Transport;
}): PromptObject[] {
  return [
    {
      type: 'text',
      name: 'projectName',
      message: 'Project name:',
      initial: defaults.projectName,
      validate: (value: string) =>
        /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(value)
          ? true
          : 'Must be a valid npm package name (lowercase, no spaces)',
    },
    {
      type: 'select',
      name: 'transport',
      message: 'Transport:',
      choices: [
        { title: 'HTTP (Streamable HTTP)', value: 'http' },
        { title: 'stdio (stdin/stdout)', value: 'stdio' },
        { title: 'Both (HTTP + stdio)', value: 'both' },
      ],
      initial: defaults.transport === 'stdio' ? 1 : defaults.transport === 'both' ? 2 : 0,
    },
    {
      type: (_prev: unknown, values: Record<string, unknown>) =>
        (values.transport as string) !== 'stdio' ? 'confirm' : null,
      name: 'auth',
      message: 'Include JWT auth (@onivoro/server-mcp-auth)?',
      initial: false,
    },
    {
      type: (_prev: unknown, values: Record<string, unknown>) =>
        values.auth ? 'confirm' : null,
      name: 'oauth',
      message: 'Include embedded OAuth server (@onivoro/server-mcp-oauth)?',
      initial: false,
    },
  ];
}

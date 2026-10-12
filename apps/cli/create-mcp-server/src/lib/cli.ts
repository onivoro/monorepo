import prompts from 'prompts';
import { buildPrompts } from './prompts';
import { generate } from './generator';
import type { ScaffoldOptions, Transport } from './types';

/** A mistake in how the CLI was invoked: reported as a plain message, without a stack. */
export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

/** Why `--oauth` is gone, for anyone still passing it. */
export const OAUTH_FLAG_REMOVED_MESSAGE =
  '--oauth has been removed: @onivoro/server-mcp-oauth, the embedded OAuth server it added, is deprecated. ' +
  'Use --auth, and run a dedicated authorization server (such as Amazon Cognito, Auth0, Entra ID or Keycloak) whose tokens @onivoro/server-mcp-auth validates.';

export function parseArgs(argv: string[]): {
  skip: boolean;
  overrides: Partial<ScaffoldOptions>;
} {
  const overrides: Partial<ScaffoldOptions> = {};
  let skip = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--yes' || arg === '-y') {
      skip = true;
    } else if (arg === '--name' && argv[i + 1]) {
      overrides.projectName = argv[++i];
    } else if (arg === '--transport' && argv[i + 1]) {
      const t = argv[++i] as Transport;
      if (['http', 'stdio', 'both'].includes(t)) {
        overrides.transport = t;
      }
    } else if (arg === '--auth') {
      overrides.auth = true;
    } else if (arg === '--oauth') {
      throw new CliUsageError(OAUTH_FLAG_REMOVED_MESSAGE);
    } else if (!arg.startsWith('-') && !overrides.projectName) {
      overrides.projectName = arg;
    }
  }

  return { skip, overrides };
}

export async function run(argv: string[]): Promise<void> {
  const { skip, overrides } = parseArgs(argv);

  const defaults = {
    projectName: overrides.projectName || 'my-mcp-server',
    transport: (overrides.transport || 'http') as Transport,
  };

  let options: ScaffoldOptions;

  if (skip) {
    options = {
      projectName: defaults.projectName,
      transport: defaults.transport,
      auth: overrides.auth ?? false,
    };
  } else {
    const answers = await prompts(buildPrompts(defaults), {
      onCancel: () => {
        console.log('\nScaffolding cancelled.');
        process.exit(0);
      },
    });

    options = {
      projectName: answers.projectName ?? defaults.projectName,
      transport: answers.transport ?? defaults.transport,
      auth: answers.auth ?? false,
    };

    // Apply CLI overrides on top of prompt answers
    if (overrides.projectName) options.projectName = overrides.projectName;
    if (overrides.transport) options.transport = overrides.transport;
    if (overrides.auth) options.auth = true;
  }

  await generate(options);
}

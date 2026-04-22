import prompts from 'prompts';
import { buildPrompts } from './prompts';
import { generate } from './generator';
import type { ScaffoldOptions, Transport } from './types';

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
      overrides.oauth = true;
      overrides.auth = true;
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
      oauth: overrides.oauth ?? false,
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
      oauth: answers.oauth ?? false,
    };

    // Apply CLI overrides on top of prompt answers
    if (overrides.projectName) options.projectName = overrides.projectName;
    if (overrides.transport) options.transport = overrides.transport;
    if (overrides.auth) options.auth = true;
    if (overrides.oauth) {
      options.oauth = true;
      options.auth = true;
    }
  }

  await generate(options);
}

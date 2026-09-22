import { AgenticPrompt, AgenticPromptParameter } from './agentic-prompt.types';

const parameterPattern = /^[A-Za-z][A-Za-z0-9_]*$/;

export class AgenticPromptTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgenticPromptTemplateError';
  }
}

export function extractAgenticPromptParameters(
  prompt: string,
): AgenticPromptParameter[] {
  validateBalancedDelimiters(prompt);

  const names = new Set<string>();
  for (const match of prompt.matchAll(/{{\s*([^{}]*?)\s*}}/g)) {
    const name = match[1].trim();
    if (!name) {
      throw new AgenticPromptTemplateError(
        'Prompt parameter names cannot be empty.',
      );
    }

    if (!parameterPattern.test(name)) {
      throw new AgenticPromptTemplateError(
        `Invalid prompt parameter name: ${name}.`,
      );
    }

    names.add(name);
  }

  return [...names].map((name) => ({
    name,
    label: labelFromParameterName(name),
    required: true,
  }));
}

export function renderAgenticPrompt(
  prompt: Pick<AgenticPrompt, 'parameters' | 'prompt'>,
  values: Record<string, string>,
): string {
  const resolved = Object.fromEntries(
    prompt.parameters.map((parameter) => {
      const value = values[parameter.name]?.trim() ?? '';
      if (parameter.required && !value) {
        throw new AgenticPromptTemplateError(
          `Missing prompt parameter value: ${parameter.name}.`,
        );
      }
      return [parameter.name, value];
    }),
  );

  return prompt.prompt.replace(/{{\s*([^{}]*?)\s*}}/g, (_match, name) => {
    const key = String(name).trim();
    return resolved[key] ?? '';
  });
}

function validateBalancedDelimiters(prompt: string): void {
  const opens = prompt.match(/{{/g)?.length ?? 0;
  const closes = prompt.match(/}}/g)?.length ?? 0;

  if (opens !== closes) {
    throw new AgenticPromptTemplateError(
      'Prompt template has unbalanced parameter delimiters.',
    );
  }

  if (/{{[^{}]*{{|}}[^{}]*}}/.test(prompt)) {
    throw new AgenticPromptTemplateError(
      'Prompt template has malformed parameter delimiters.',
    );
  }
}

function labelFromParameterName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (value) => value.toUpperCase());
}

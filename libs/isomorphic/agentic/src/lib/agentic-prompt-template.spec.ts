import {
  AgenticPromptTemplateError,
  extractAgenticPromptParameters,
  renderAgenticPrompt,
} from './agentic-prompt-template';

describe('agentic prompt templates', () => {
  it('extracts deduplicated parameters', () => {
    expect(
      extractAgenticPromptParameters(
        'Summarize {{ patientId }} for {{visitDate}} and {{patientId}}.',
      ),
    ).toEqual([
      { name: 'patientId', label: 'Patient Id', required: true },
      { name: 'visitDate', label: 'Visit Date', required: true },
    ]);
  });

  it('rejects malformed templates', () => {
    expect(() => extractAgenticPromptParameters('Hello {{name')).toThrow(
      AgenticPromptTemplateError,
    );
    expect(() => extractAgenticPromptParameters('Hello {{}}')).toThrow(
      AgenticPromptTemplateError,
    );
    expect(() => extractAgenticPromptParameters('Hello {{1bad}}')).toThrow(
      AgenticPromptTemplateError,
    );
  });

  it('renders required values into a prompt', () => {
    const parameters = extractAgenticPromptParameters(
      'Find order {{ orderId }} for {{email}}.',
    );

    expect(
      renderAgenticPrompt(
        { parameters, prompt: 'Find order {{ orderId }} for {{email}}.' },
        { orderId: '123', email: 'test@example.com' },
      ),
    ).toBe('Find order 123 for test@example.com.');
  });

  it('rejects missing required render values', () => {
    const parameters = extractAgenticPromptParameters('Find {{ orderId }}.');

    expect(() =>
      renderAgenticPrompt({ parameters, prompt: 'Find {{ orderId }}.' }, {}),
    ).toThrow(AgenticPromptTemplateError);
  });
});

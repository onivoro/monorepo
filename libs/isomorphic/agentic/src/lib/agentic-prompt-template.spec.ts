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

describe('agentic prompt template edge cases', () => {
  it('returns no parameters for a template without placeholders', () => {
    expect(extractAgenticPromptParameters('Plain text.')).toEqual([]);
  });

  it('labels snake_case and camelCase names', () => {
    expect(
      extractAgenticPromptParameters('{{first_name}} {{ssnLast4}} {{x}}').map(
        (p) => p.label,
      ),
    ).toEqual(['First name', 'Ssn Last4', 'X']);
  });

  it('rejects nested delimiters with a malformed message', () => {
    expect(() => extractAgenticPromptParameters('{{a {{b}} c}}')).toThrow(
      'Prompt template has malformed parameter delimiters.',
    );
  });

  it('names the offending parameter', () => {
    expect(() => extractAgenticPromptParameters('{{ bad-name }}')).toThrow(
      'Invalid prompt parameter name: bad-name.',
    );
    expect(() => extractAgenticPromptParameters('{{   }}')).toThrow(
      'Prompt parameter names cannot be empty.',
    );
  });

  it('sets the error name', () => {
    expect(new AgenticPromptTemplateError('x').name).toBe(
      'AgenticPromptTemplateError',
    );
  });

  it('trims values, allows blank optional values and blanks unknown placeholders', () => {
    expect(
      renderAgenticPrompt(
        {
          prompt: '[{{a}}][{{ b }}][{{c}}]',
          parameters: [
            { name: 'a', label: 'A', required: true },
            { name: 'b', label: 'B', required: false },
          ],
        },
        { a: '  one  ', c: 'ignored' },
      ),
    ).toBe('[one][][]');
  });

  it('treats whitespace-only required values as missing', () => {
    expect(() =>
      renderAgenticPrompt(
        {
          prompt: '{{a}}',
          parameters: [{ name: 'a', label: 'A', required: true }],
        },
        { a: '   ' },
      ),
    ).toThrow('Missing prompt parameter value: a.');
  });
});

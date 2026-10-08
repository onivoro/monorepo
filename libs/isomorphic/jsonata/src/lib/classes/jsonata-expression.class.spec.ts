import {
  JsonataExpressionService,
  REG_INTERPOLATION,
} from './jsonata-expression.class';

describe('JsonataExpressionService', () => {
  const svc = new JsonataExpressionService();

  describe('extractInterpolations', () => {
    it('returns every {{...}} occurrence in order', () => {
      expect(
        svc.extractInterpolations(
          'Dear {{ name }}, you owe {{AMOUNT}} by {{due  date}}.',
        ),
      ).toEqual(['{{ name }}', '{{AMOUNT}}', '{{due  date}}']);
    });

    it('matches non-greedily', () => {
      expect(svc.extractInterpolations('{{a}}{{b}}')).toEqual([
        '{{a}}',
        '{{b}}',
      ]);
    });

    it('returns null when there are none', () => {
      expect(svc.extractInterpolations('nothing here {{}}')).toBeNull();
    });

    it('exports the interpolation regex', () => {
      expect('x {{y}} z'.match(REG_INTERPOLATION)).toEqual(['{{y}}']);
    });
  });

  describe('validateInterpolations', () => {
    it('treats interpolations containing "<" as invalid', () => {
      const matches = [
        '{{A}}',
        '{{<b>B</b>}}',
        '{{C}}',
      ] as unknown as RegExpMatchArray;

      expect(svc.validateInterpolations(matches)).toEqual({
        valid: ['{{A}}', '{{C}}'],
        invalid: ['{{<b>B</b>}}'],
      });
    });

    it('handles an empty list', () => {
      expect(
        svc.validateInterpolations([] as unknown as RegExpMatchArray),
      ).toEqual({
        valid: [],
        invalid: [],
      });
    });
  });

  describe('normalizeInterpolations', () => {
    it('upper-cases, collapses spaces, trims and rewrites the content', () => {
      const content =
        'Hi {{ first   name }}, total {{TOTAL}}; again {{ first   name }}';

      expect(
        svc.normalizeInterpolations(content, [
          '{{ first   name }}',
          '{{TOTAL}}',
          '{{ first   name }}',
        ]),
      ).toEqual({
        normalizedInterpolations: [
          '{{FIRST NAME}}',
          '{{TOTAL}}',
          '{{FIRST NAME}}',
        ],
        updatedContent:
          'Hi {{FIRST NAME}}, total {{TOTAL}}; again {{FIRST NAME}}',
      });
    });

    it('leaves content untouched when nothing needs normalizing', () => {
      expect(svc.normalizeInterpolations('a {{B}}', ['{{B}}'])).toEqual({
        normalizedInterpolations: ['{{B}}'],
        updatedContent: 'a {{B}}',
      });
    });
  });

  describe('braces helpers', () => {
    it('removes all braces and trims', () => {
      expect(svc.removeBracesFromInterpolation('{{ a }}')).toBe('a');
      expect(svc.removeBracesFromInterpolation('{{{{a}}}}')).toBe('a');
      expect(svc.removeBracesFromInterpolation('plain')).toBe('plain');
    });

    it('adds braces without doubling them', () => {
      expect(svc.addBracesToInterpolation('a')).toBe('{{a}}');
      expect(svc.addBracesToInterpolation('{{ a }}')).toBe('{{a}}');
    });
  });

  describe('segregateUniqueInterpolations', () => {
    it('de-duplicates and separates interpolations without an existing expression', async () => {
      const result = await svc.segregateUniqueInterpolations(
        ['{{A}}', '{{B}}', '{{A}}', '{{C}}'],
        [
          { expression: 'A', code: 'a' },
          { expression: '{{ C }}', code: 'c' },
        ],
      );

      expect(result).toEqual({
        uniqueNormalizedInterpolations: ['{{A}}', '{{B}}', '{{C}}'],
        novelInterpolations: ['{{B}}'],
      });
    });

    it('treats everything as novel when there are no existing expressions', async () => {
      expect(await svc.segregateUniqueInterpolations(['{{X}}'], [])).toEqual({
        uniqueNormalizedInterpolations: ['{{X}}'],
        novelInterpolations: ['{{X}}'],
      });
    });
  });
});

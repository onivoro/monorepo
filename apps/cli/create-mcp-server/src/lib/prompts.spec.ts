import { buildPrompts } from './prompts';

describe('buildPrompts', () => {
  it('should return 4 prompt definitions', () => {
    const result = buildPrompts({ projectName: 'test', transport: 'http' });
    expect(result).toHaveLength(4);
  });

  it('should set projectName initial value from defaults', () => {
    const result = buildPrompts({ projectName: 'my-app', transport: 'http' });
    expect(result[0].initial).toBe('my-app');
  });

  it('should set transport initial to 0 for http', () => {
    const result = buildPrompts({ projectName: 'test', transport: 'http' });
    expect(result[1].initial).toBe(0);
  });

  it('should set transport initial to 1 for stdio', () => {
    const result = buildPrompts({ projectName: 'test', transport: 'stdio' });
    expect(result[1].initial).toBe(1);
  });

  it('should set transport initial to 2 for both', () => {
    const result = buildPrompts({ projectName: 'test', transport: 'both' });
    expect(result[1].initial).toBe(2);
  });

  describe('auth prompt conditional type', () => {
    it('should show auth prompt when transport is http', () => {
      const result = buildPrompts({ projectName: 'test', transport: 'http' });
      const typeFn = result[2].type as Function;
      expect(typeFn(undefined, { transport: 'http' })).toBe('confirm');
    });

    it('should show auth prompt when transport is both', () => {
      const result = buildPrompts({ projectName: 'test', transport: 'http' });
      const typeFn = result[2].type as Function;
      expect(typeFn(undefined, { transport: 'both' })).toBe('confirm');
    });

    it('should hide auth prompt when transport is stdio', () => {
      const result = buildPrompts({ projectName: 'test', transport: 'http' });
      const typeFn = result[2].type as Function;
      expect(typeFn(undefined, { transport: 'stdio' })).toBeNull();
    });
  });

  describe('oauth prompt conditional type', () => {
    it('should show oauth prompt when auth is true', () => {
      const result = buildPrompts({ projectName: 'test', transport: 'http' });
      const typeFn = result[3].type as Function;
      expect(typeFn(undefined, { auth: true })).toBe('confirm');
    });

    it('should hide oauth prompt when auth is false', () => {
      const result = buildPrompts({ projectName: 'test', transport: 'http' });
      const typeFn = result[3].type as Function;
      expect(typeFn(undefined, { auth: false })).toBeNull();
    });
  });

  describe('projectName validation', () => {
    it('should accept valid npm package names', () => {
      const result = buildPrompts({ projectName: 'test', transport: 'http' });
      const validate = result[0].validate as (value: string) => boolean | string;
      expect(validate('my-app')).toBe(true);
      expect(validate('app123')).toBe(true);
      expect(validate('my.app')).toBe(true);
    });

    it('should reject invalid names', () => {
      const result = buildPrompts({ projectName: 'test', transport: 'http' });
      const validate = result[0].validate as (value: string) => boolean | string;
      expect(validate('My App')).not.toBe(true);
      expect(validate('')).not.toBe(true);
      expect(validate('UPPERCASE')).not.toBe(true);
    });
  });
});

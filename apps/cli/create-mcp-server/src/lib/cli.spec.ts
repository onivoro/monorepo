import { parseArgs } from './cli';

describe('parseArgs', () => {
  it('should return defaults when no args', () => {
    const result = parseArgs([]);
    expect(result.skip).toBe(false);
    expect(result.overrides).toEqual({});
  });

  it('should parse --yes flag', () => {
    expect(parseArgs(['--yes']).skip).toBe(true);
    expect(parseArgs(['-y']).skip).toBe(true);
  });

  it('should parse --name', () => {
    const result = parseArgs(['--name', 'my-app']);
    expect(result.overrides.projectName).toBe('my-app');
  });

  it('should parse positional arg as project name', () => {
    const result = parseArgs(['my-app']);
    expect(result.overrides.projectName).toBe('my-app');
  });

  it('should prefer --name over positional', () => {
    const result = parseArgs(['positional', '--name', 'named']);
    expect(result.overrides.projectName).toBe('named');
  });

  it('should parse --transport', () => {
    expect(parseArgs(['--transport', 'http']).overrides.transport).toBe('http');
    expect(parseArgs(['--transport', 'stdio']).overrides.transport).toBe('stdio');
    expect(parseArgs(['--transport', 'both']).overrides.transport).toBe('both');
  });

  it('should ignore invalid transport values', () => {
    expect(parseArgs(['--transport', 'websocket']).overrides.transport).toBeUndefined();
  });

  it('should parse --auth', () => {
    expect(parseArgs(['--auth']).overrides.auth).toBe(true);
  });

  it('should parse --oauth and imply --auth', () => {
    const result = parseArgs(['--oauth']);
    expect(result.overrides.oauth).toBe(true);
    expect(result.overrides.auth).toBe(true);
  });

  it('should combine multiple flags', () => {
    const result = parseArgs(['-y', '--name', 'test', '--transport', 'both', '--auth']);
    expect(result.skip).toBe(true);
    expect(result.overrides.projectName).toBe('test');
    expect(result.overrides.transport).toBe('both');
    expect(result.overrides.auth).toBe(true);
  });

  it('should not treat flag values as positional args', () => {
    const result = parseArgs(['--name', 'my-app', '--transport', 'http']);
    expect(result.overrides.projectName).toBe('my-app');
    expect(result.overrides.transport).toBe('http');
  });
});

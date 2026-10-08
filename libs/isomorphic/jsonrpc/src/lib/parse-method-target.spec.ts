import {
  createTargetedMethod,
  hasTarget,
  METHOD_TARGET_DELIMITER,
  parseMethodTarget,
  shouldRouteToTarget,
} from './parse-method-target';

describe('parseMethodTarget', () => {
  it('returns no target when there is no delimiter', () => {
    expect(parseMethodTarget('health')).toEqual({
      target: null,
      method: 'health',
      original: 'health',
    });
  });

  it('extracts a valid target prefix', () => {
    expect(parseMethodTarget('server.health')).toEqual({
      target: 'server',
      method: 'health',
      original: 'server.health',
    });
  });

  it('only splits on the first delimiter', () => {
    expect(parseMethodTarget('broadcast.user.updated')).toEqual({
      target: 'broadcast',
      method: 'user.updated',
      original: 'broadcast.user.updated',
    });
  });

  it('keeps the whole string as method when the prefix is not a target', () => {
    expect(parseMethodTarget('user.get')).toEqual({
      target: null,
      method: 'user.get',
      original: 'user.get',
    });
  });

  it('allows an empty method after a valid target', () => {
    expect(parseMethodTarget('webview.')).toEqual({
      target: 'webview',
      method: '',
      original: 'webview.',
    });
  });

  it('treats a leading delimiter as an invalid (empty) prefix', () => {
    expect(parseMethodTarget('.health')).toEqual({
      target: null,
      method: '.health',
      original: '.health',
    });
  });

  it('handles an empty string', () => {
    expect(parseMethodTarget('')).toEqual({
      target: null,
      method: '',
      original: '',
    });
  });
});

describe('createTargetedMethod', () => {
  it('joins target and method with the delimiter', () => {
    expect(METHOD_TARGET_DELIMITER).toBe('.');
    expect(createTargetedMethod('server', 'health')).toBe('server.health');
    expect(createTargetedMethod('extension', 'a.b')).toBe('extension.a.b');
  });

  it('round-trips through parseMethodTarget', () => {
    const parsed = parseMethodTarget(createTargetedMethod('webview', 'x.y'));
    expect(parsed.target).toBe('webview');
    expect(parsed.method).toBe('x.y');
  });
});

describe('hasTarget', () => {
  it('is true only for the matching target', () => {
    expect(hasTarget('server.health', 'server')).toBe(true);
    expect(hasTarget('server.health', 'webview')).toBe(false);
  });

  it('is false for untargeted methods', () => {
    expect(hasTarget('health', 'server')).toBe(false);
  });

  it('does not treat broadcast as matching other targets', () => {
    expect(hasTarget('broadcast.sync', 'server')).toBe(false);
    expect(hasTarget('broadcast.sync', 'broadcast')).toBe(true);
  });
});

describe('shouldRouteToTarget', () => {
  it('routes explicitly targeted methods to their target only', () => {
    expect(shouldRouteToTarget('server.health', 'server')).toBe(true);
    expect(shouldRouteToTarget('server.health', 'webview')).toBe(false);
  });

  it('routes broadcasts to every target', () => {
    expect(shouldRouteToTarget('broadcast.update', 'server')).toBe(true);
    expect(shouldRouteToTarget('broadcast.update', 'webview')).toBe(true);
    expect(shouldRouteToTarget('broadcast.update', 'extension')).toBe(true);
  });

  it('does not route untargeted methods anywhere', () => {
    expect(shouldRouteToTarget('health', 'server')).toBe(false);
    expect(shouldRouteToTarget('user.get', 'server')).toBe(false);
  });
});

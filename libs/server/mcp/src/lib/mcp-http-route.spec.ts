import {
  DEFAULT_MCP_HTTP_ROUTE,
  normalizeMcpHttpRoute,
  normalizePath,
} from './mcp-http-route';

describe('normalizeMcpHttpRoute', () => {
  it('should default to "mcp" when route is undefined or null', () => {
    expect(DEFAULT_MCP_HTTP_ROUTE).toBe('mcp');
    expect(normalizeMcpHttpRoute()).toBe('mcp');
    expect(normalizeMcpHttpRoute(null as any)).toBe('mcp');
  });

  it('should strip leading and trailing slashes', () => {
    expect(normalizeMcpHttpRoute('/api/mcp/')).toBe('api/mcp');
    expect(normalizeMcpHttpRoute('///mcp///')).toBe('mcp');
  });

  it('should collapse empty and whitespace segments', () => {
    expect(normalizeMcpHttpRoute(' api // mcp ')).toBe('api/mcp');
  });

  it('should reject query strings and fragments', () => {
    expect(() => normalizeMcpHttpRoute('mcp?x=1')).toThrow(
      /without query or fragment/,
    );
    expect(() => normalizeMcpHttpRoute('mcp#frag')).toThrow(
      /without query or fragment/,
    );
  });

  it('should reject routes that normalize to empty', () => {
    expect(() => normalizeMcpHttpRoute('')).toThrow(/must not be empty/);
    expect(() => normalizeMcpHttpRoute('///')).toThrow(/must not be empty/);
    expect(() => normalizeMcpHttpRoute('   ')).toThrow(/must not be empty/);
  });

  it('should reject "." and ".." segments', () => {
    expect(() => normalizeMcpHttpRoute('api/../mcp')).toThrow(
      /must not include "\." or "\.\." segments/,
    );
    expect(() => normalizeMcpHttpRoute('./mcp')).toThrow(/segments/);
    expect(() => normalizeMcpHttpRoute('api/ .. /mcp')).toThrow(/segments/);
  });

  it('should allow dots inside segment names', () => {
    expect(normalizeMcpHttpRoute('v1.0/mcp')).toBe('v1.0/mcp');
    expect(normalizeMcpHttpRoute('.well-known/mcp')).toBe('.well-known/mcp');
  });
});

describe('normalizePath', () => {
  it('should drop the query string', () => {
    expect(normalizePath('/api/mcp?session=1')).toBe('api/mcp');
  });

  it('should return empty string for root', () => {
    expect(normalizePath('/')).toBe('');
    expect(normalizePath('')).toBe('');
  });

  it('should trim surrounding whitespace and slashes', () => {
    expect(normalizePath('  /a/b/  ')).toBe('a/b');
  });
});

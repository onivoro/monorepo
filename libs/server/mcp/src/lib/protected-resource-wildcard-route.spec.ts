import {
  protectedResourceWildcardRoute,
  wildcardParamToPath,
} from './protected-resource-wildcard-route';

describe('protectedResourceWildcardRoute', () => {
  it('uses the form each Nest major accepts', () => {
    expect(protectedResourceWildcardRoute('10.4.20')).toBe(':resourcePath(*)');
    expect(protectedResourceWildcardRoute('11.2.1')).toBe('*resourcePath');
  });
});

describe('wildcardParamToPath', () => {
  it('joins the segments Nest 11 yields', () => {
    expect(wildcardParamToPath(['api', 'mcp'])).toBe('api/mcp');
  });

  it('passes through the string Nest 10 yields', () => {
    expect(wildcardParamToPath('api/mcp')).toBe('api/mcp');
  });

  it('treats a missing value as the empty path', () => {
    expect(wildcardParamToPath(undefined)).toBe('');
  });
});

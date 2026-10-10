import { Logger } from '@nestjs/common';
import {
  detectNestMajor,
  PROTECTED_RESOURCE_WILDCARD,
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

  it('drops a trailing slash in either form', () => {
    expect(wildcardParamToPath('api/mcp/')).toBe('api/mcp');
    expect(wildcardParamToPath(['api', 'mcp', ''])).toBe('api/mcp');
  });

  it('keeps leading and doubled slashes in either form', () => {
    expect(wildcardParamToPath('/api/mcp')).toBe('/api/mcp');
    expect(wildcardParamToPath(['', 'api', 'mcp'])).toBe('/api/mcp');
    expect(wildcardParamToPath('api//mcp')).toBe('api//mcp');
    expect(wildcardParamToPath(['api', '', 'mcp'])).toBe('api//mcp');
  });
});

describe('detectNestMajor', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('uses the first lookup that yields a version', () => {
    const second = jest.fn(() => '10.4.20');
    expect(detectNestMajor([() => '11.1.0', second])).toBe(11);
    expect(second).not.toHaveBeenCalled();
  });

  it('moves on when a lookup throws', () => {
    expect(
      detectNestMajor([
        () => {
          throw new Error("Cannot find module '@nestjs/core/package.json'");
        },
        () => '10.4.20',
      ]),
    ).toBe(10);
  });

  it('moves on when a lookup yields no usable version', () => {
    expect(detectNestMajor([() => undefined, () => 'x', () => '11.0.0'])).toBe(
      11,
    );
  });

  it('assumes Nest 11 and warns when no lookup yields a version', () => {
    expect(detectNestMajor([() => undefined])).toBe(11);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('assuming Nest 11'),
    );
  });

  it('reads the installed version by default', () => {
    const installed = require('@nestjs/core/package.json').version;
    expect(detectNestMajor()).toBe(Number.parseInt(installed, 10));
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('PROTECTED_RESOURCE_WILDCARD', () => {
  it('matches the installed Nest', () => {
    const installed = require('@nestjs/core/package.json').version;
    expect(PROTECTED_RESOURCE_WILDCARD).toBe(
      protectedResourceWildcardRoute(installed),
    );
  });
});

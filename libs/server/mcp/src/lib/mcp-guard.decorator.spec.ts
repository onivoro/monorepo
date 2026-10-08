import 'reflect-metadata';
import { McpGuard } from './mcp-guard.decorator';
import { MCP_GUARD_METADATA } from './mcp-guard-metadata-token';
import type { McpCanActivate } from './mcp-can-activate';

class AllowGuard implements McpCanActivate {
  canActivate() {
    return true;
  }
}

class DenyGuard implements McpCanActivate {
  canActivate() {
    return false;
  }
}

describe('McpGuard', () => {
  it('should attach guard metadata with config to the method', () => {
    class Service {
      @McpGuard(AllowGuard, { scopes: ['read'] })
      method() {
        return 'ok';
      }
    }

    expect(
      Reflect.getMetadata(MCP_GUARD_METADATA, Service.prototype.method),
    ).toEqual([{ guardClass: AllowGuard, config: { scopes: ['read'] } }]);
  });

  it('should leave config undefined when not provided', () => {
    class Service {
      @McpGuard(AllowGuard)
      method() {
        return 'ok';
      }
    }

    expect(
      Reflect.getMetadata(MCP_GUARD_METADATA, Service.prototype.method),
    ).toEqual([{ guardClass: AllowGuard, config: undefined }]);
  });

  it('should stack multiple guards', () => {
    class Service {
      @McpGuard(AllowGuard, { a: 1 })
      @McpGuard(DenyGuard, { b: 2 })
      method() {
        return 'ok';
      }
    }

    const guards = Reflect.getMetadata(
      MCP_GUARD_METADATA,
      Service.prototype.method,
    );
    expect(guards).toHaveLength(2);
    expect(guards).toEqual(
      expect.arrayContaining([
        { guardClass: AllowGuard, config: { a: 1 } },
        { guardClass: DenyGuard, config: { b: 2 } },
      ]),
    );
  });

  it('should store stacked guards bottom-up (closest to the method first)', () => {
    class Service {
      @McpGuard(AllowGuard)
      @McpGuard(DenyGuard)
      method() {
        return 'ok';
      }
    }

    const guards = Reflect.getMetadata(
      MCP_GUARD_METADATA,
      Service.prototype.method,
    );
    expect(guards.map((g: any) => g.guardClass)).toEqual([
      DenyGuard,
      AllowGuard,
    ]);
  });

  it('should not leak guard metadata between methods', () => {
    class Service {
      @McpGuard(AllowGuard)
      guarded() {
        return 'ok';
      }

      unguarded() {
        return 'ok';
      }
    }

    expect(
      Reflect.getMetadata(MCP_GUARD_METADATA, Service.prototype.unguarded),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(MCP_GUARD_METADATA, Service.prototype.guarded),
    ).toHaveLength(1);
  });
});

import {
  ENV_MEMBER_METADATA,
  EnvOptional,
  EnvRequired,
  getEnvDecoratedMembers,
  getEnvMembers,
  getEnvRequiredMembers,
} from './env-member.decorator';

describe('env member decorators', () => {
  it('records required and optional members', () => {
    class Config {
      @EnvRequired() A?: string;
      @EnvOptional() B?: string;
      @EnvRequired() C?: string;
      D?: string;
    }

    expect(getEnvRequiredMembers(Config)).toEqual(['A', 'C']);
    expect(getEnvDecoratedMembers(Config)).toEqual(['A', 'B', 'C']);
  });

  it('includes members decorated on parent classes without changing the parent', () => {
    class Base {
      @EnvRequired() A?: string;
      @EnvRequired() B?: string;
    }

    class Child extends Base {
      @EnvRequired() C?: string;
    }

    expect(getEnvRequiredMembers(Child)).toEqual(['A', 'B', 'C']);
    expect(getEnvRequiredMembers(Base)).toEqual(['A', 'B']);
  });

  it('lets a subclass redeclare a parent member as optional', () => {
    class Base {
      @EnvRequired() A?: string;
    }

    class Child extends Base {}
    EnvOptional()(Child.prototype, 'A');

    expect(getEnvRequiredMembers(Child)).toEqual([]);
    expect(getEnvDecoratedMembers(Child)).toEqual(['A']);
  });

  it('returns empty lists for a class without decorated members', () => {
    class Config {
      A?: string;
    }

    expect(getEnvRequiredMembers(Config)).toEqual([]);
    expect(getEnvDecoratedMembers(Config)).toEqual([]);
  });

  describe('getEnvMembers', () => {
    it('combines instance properties with decorated members', () => {
      class Config {
        A = 'default';
        B?: string;
      }

      // Decorated members missing at runtime, as with useDefineForClassFields: false.
      EnvRequired()(Config.prototype, 'C');
      EnvOptional()(Config.prototype, 'D');

      expect(getEnvMembers(Config)).toEqual(['A', 'B', 'C', 'D']);
    });
  });

  it('uses a registry key shared by every copy of the package', () => {
    expect(ENV_MEMBER_METADATA).toBe(
      Symbol.for('@onivoro/server-common:env-member'),
    );
  });
});

import 'reflect-metadata';
import { OptionMeta } from 'nest-commander/src/constants';
import { CliOptional, CliRequired } from './cli-option.decorator';

const optionMeta = (fn: unknown) =>
  Reflect.getMetadata(OptionMeta, fn as object);

describe('CliOptional / CliRequired', () => {
  class Params {
    @CliRequired({ description: 'the target environment' })
    env!: string;

    @CliOptional()
    verbose?: string;

    @CliOptional()
    parseCount(value: string) {
      return Number(value);
    }
  }

  const proto = Params.prototype as any;

  it('derives the flags from the property name', () => {
    expect(optionMeta(proto.env).flags).toBe('--env [env]');
    expect(optionMeta(proto.verbose).flags).toBe('--verbose [verbose]');
  });

  it('marks CliRequired options as required', () => {
    expect(optionMeta(proto.env)).toEqual({
      description: 'the target environment',
      required: true,
      flags: '--env [env]',
    });
  });

  it('marks CliOptional options as not required', () => {
    expect(optionMeta(proto.verbose)).toEqual({
      required: false,
      flags: '--verbose [verbose]',
    });
  });

  it('installs an identity parser on a plain property', () => {
    expect(proto.env('value')).toBe('value');
  });

  it('keeps an existing method as the parser', () => {
    expect(proto.parseCount('3')).toBe(3);
    expect(optionMeta(proto.parseCount).flags).toBe(
      '--parseCount [parseCount]',
    );
  });

  it('CliOptional forces required: false even when the caller passes required', () => {
    class Overrides {
      @CliOptional({ required: true } as any)
      a?: string;
    }

    expect(optionMeta((Overrides.prototype as any).a).required).toBe(false);
  });
});

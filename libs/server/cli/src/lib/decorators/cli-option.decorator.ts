import { applyDecorators } from '@nestjs/common';
import { Option, OptionMetadata } from 'nest-commander';

function CliOption(_options?: Omit<OptionMetadata, 'flags'> & { flags?: OptionMetadata['flags'] }) {
  return (target: object, propertyKey: string | symbol): any => {

    const _propertyKey = String(propertyKey);

    if (!(target as any)[_propertyKey]) {
      (target as any)[_propertyKey] = (_?: any) => _;
    }

    const descriptor = Object.getOwnPropertyDescriptor(target, _propertyKey);

    const options = { ..._options, flags: `--${_propertyKey} [${_propertyKey}]` };
    return Option(options)(target, propertyKey, descriptor!);
  };
}


export const CliOptional = (_options?: Omit<OptionMetadata, 'flags' | 'required'> & { flags?: OptionMetadata['flags'], required?: OptionMetadata['required'] }) => applyDecorators(CliOption({ ..._options, required: false }));
export const CliRequired = (_options?: Omit<OptionMetadata, 'flags' | 'required'> & { flags?: OptionMetadata['flags'], required?: OptionMetadata['required'] }) => applyDecorators(CliOption({ ..._options, required: true }));
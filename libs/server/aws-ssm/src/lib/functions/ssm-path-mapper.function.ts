import { SSMKeyMapper } from '../types/ssm-environment.types';

export type SSMPathCase = 'preserve' | 'kebab' | 'lower';

const VALID_SSM_PATH = /^[a-zA-Z0-9_.\-/]+$/;

export function ssmPathMapper(
  prefix: string | (() => string),
  options: { case?: SSMPathCase } = {},
): SSMKeyMapper {
  return (member) => {
    const resolvedPrefix = typeof prefix === 'function' ? prefix() : prefix;
    const segments = [
      ...resolvedPrefix.split('/'),
      transform(member, options.case ?? 'preserve'),
    ].filter(Boolean);
    const path = `/${segments.join('/')}`;

    if (!VALID_SSM_PATH.test(path)) {
      throw new Error(`invalid SSM parameter path "${path}" for ${member}`);
    }

    return path;
  };
}

function transform(member: string, pathCase: SSMPathCase) {
  switch (pathCase) {
    case 'kebab':
      return member
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/_/g, '-')
        .toLowerCase();
    case 'lower':
      return member.toLowerCase();
    default:
      return member;
  }
}

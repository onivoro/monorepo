import { asCommand } from './as-command.function';

describe('asCommand', () => {
  it('builds an argv with the default entry file and each param as a flag', () => {
    expect(asCommand('deploy', { env: 'prod', replicas: 3 })).toEqual([
      'main.js',
      'deploy',
      '--env',
      'prod',
      '--replicas',
      '3',
    ]);
  });

  it('uses the given entry file', () => {
    expect(asCommand('deploy', {}, 'cli.js')).toEqual(['cli.js', 'deploy']);
  });

  it('tolerates null or undefined params', () => {
    expect(asCommand('noop', null)).toEqual(['main.js', 'noop']);
    expect(asCommand('noop', undefined)).toEqual(['main.js', 'noop']);
  });

  it('stringifies non-string values', () => {
    expect(asCommand('x', { flag: true, nothing: undefined })).toEqual([
      'main.js',
      'x',
      '--flag',
      'true',
      '--nothing',
      'undefined',
    ]);
  });
});

jest.mock('fs', () => ({ readFileSync: jest.fn(() => 'CERT') }));

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { readSslCertificate } from './read-ssl-certificate.function';

describe('readSslCertificate', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    (readFileSync as jest.Mock).mockClear();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it.each([
    'localhost',
    '127.0.0.1',
    '::1',
    '0000:0000:0000:0000:0000:0000:0000:0001',
  ])('returns undefined for local host %s', (PG_HOST) => {
    expect(readSslCertificate('/machine', { PG_HOST })).toBeUndefined();
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it('reads the default certificate under the machine prefix outside production', () => {
    process.env.NODE_ENV = 'development';

    expect(readSslCertificate('/machine/', { PG_HOST: 'db.example.com' })).toBe(
      'CERT',
    );
    expect(readFileSync).toHaveBeenCalledWith(
      resolve(process.cwd(), '/machine/assets/us-east-2-bundle.pem'),
      { encoding: 'utf-8' },
    );
  });

  it('reads the certificate relative to cwd in production, ignoring the prefix', () => {
    process.env.NODE_ENV = 'production';

    readSslCertificate(
      '/machine',
      { PG_HOST: 'db.example.com' },
      'certs/custom.pem',
    );
    expect(readFileSync).toHaveBeenCalledWith(
      resolve(process.cwd(), 'certs/custom.pem'),
      {
        encoding: 'utf-8',
      },
    );
  });
});

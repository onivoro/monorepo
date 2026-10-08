import { BadRequestException } from '@nestjs/common';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFileAsJson } from './read-file-as-json.function';

describe('readFileAsJson', () => {
  let dir: string;
  let log: jest.SpyInstance;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'server-common-json-'));
    writeFileSync(join(dir, 'good.json'), '{"a":[1,2]}');
    writeFileSync(join(dir, 'bad.json'), '{oops');
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    log.mockRestore();
  });

  it('reads and parses a JSON file', async () => {
    await expect(readFileAsJson(join(dir, 'good.json'))).resolves.toEqual({
      a: [1, 2],
    });
  });

  it('throws BadRequestException when the file cannot be read', async () => {
    const path = join(dir, 'missing.json');
    await expect(readFileAsJson(path)).rejects.toThrow(
      new BadRequestException(`Could not read ${path}`),
    );
  });

  it('throws BadRequestException when the contents are not JSON', async () => {
    const path = join(dir, 'bad.json');
    const promise = readFileAsJson(path);
    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toThrow(`Could not parse ${path} as JSON: `);
  });
});

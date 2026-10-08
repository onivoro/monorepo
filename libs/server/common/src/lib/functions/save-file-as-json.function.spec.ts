jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

import { writeFile } from 'fs/promises';
import { saveFileAsJson } from './save-file-as-json.function';

describe('saveFileAsJson', () => {
  beforeEach(() => {
    (writeFile as jest.Mock).mockClear();
  });

  it('appends .json and writes pretty-printed JSON', async () => {
    await saveFileAsJson('/tmp/out', { a: 1 });
    expect(writeFile).toHaveBeenCalledWith('/tmp/out.json', '{\n  "a": 1\n}', {
      encoding: 'utf-8',
    });
  });

  it('does not double the .json extension', async () => {
    await saveFileAsJson('/tmp/out.json', [1]);
    expect(writeFile).toHaveBeenCalledWith('/tmp/out.json', '[\n  1\n]', {
      encoding: 'utf-8',
    });
  });
});

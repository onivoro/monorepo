import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractText } from './extract-text.function';

jest.mock('pdf-parse', () => jest.fn());
jest.mock('any-text', () => ({ getText: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf: jest.Mock = require('pdf-parse');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const anyText: { getText: jest.Mock } = require('any-text');

describe('extractText', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'extract-text-spec-'));
    pdf.mockReset();
    anyText.getText.mockReset();
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it.each(['doc.pdf', 'DOC.PDF'])(
    'reads %s from disk and parses it as a pdf',
    async (name) => {
      const path = join(dir, name);
      writeFileSync(path, 'pdf bytes');
      pdf.mockResolvedValue({ text: 'pdf text' });

      await expect(extractText(path)).resolves.toBe('pdf text');

      expect(pdf).toHaveBeenCalledWith(Buffer.from('pdf bytes'));
      expect(anyText.getText).not.toHaveBeenCalled();
    },
  );

  it('delegates other formats to any-text', async () => {
    anyText.getText.mockResolvedValue('docx text');

    await expect(extractText('/some/file.docx')).resolves.toBe('docx text');

    expect(anyText.getText).toHaveBeenCalledWith('/some/file.docx');
    expect(pdf).not.toHaveBeenCalled();
  });

  it('rejects when the pdf cannot be read', async () => {
    await expect(extractText(join(dir, 'missing.pdf'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join } from 'node:path';
import { OpenAiService } from './open-ai.service';
import { ServerOpenAiConfig } from '../server-open-ai-config.class';
import { extractText } from '../functions/extract-text.function';

jest.mock('../functions/extract-text.function', () => ({
  extractText: jest.fn(),
}));

const chatCompletion = (content: string) => ({
  id: 'chatcmpl-1',
  object: 'chat.completion',
  created: 0,
  model: 'gpt-4o-mini',
  choices: [
    {
      index: 0,
      finish_reason: 'stop',
      message: { role: 'assistant', content },
    },
  ],
});

function createService() {
  const openai = {
    chat: { completions: { create: jest.fn() } },
    embeddings: { create: jest.fn() },
    images: { generate: jest.fn() },
  };
  const service = new OpenAiService({} as ServerOpenAiConfig, openai as any);
  return { service, openai };
}

describe('OpenAiService', () => {
  describe('summarize', () => {
    it('returns the content of the first choice', async () => {
      const { service, openai } = createService();
      openai.chat.completions.create.mockResolvedValue(
        chatCompletion('a summary'),
      );

      const result = await service.summarize('be brief', 'some long text', {
        model: 'gpt-4o-mini',
        temperature: 0,
      });

      expect(result).toBe('a summary');
      expect(openai.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          { role: 'system', content: 'be brief' },
          { role: 'user', content: 'some long text' },
        ],
      });
    });
  });

  describe('ask', () => {
    it('returns the content of the first choice as the answer', async () => {
      const { service, openai } = createService();
      openai.embeddings.create.mockResolvedValue({
        data: [{ embedding: [1, 0], index: 0, object: 'embedding' }],
      });
      openai.chat.completions.create.mockResolvedValue(chatCompletion('42'));
      const records = [
        { id: 'a', text: 'relevant', embedding: [1, 0] },
        { id: 'b', text: 'irrelevant', embedding: [0, 1] },
      ];

      const answer = await service.ask('what is the answer?', records, {
        model: 'gpt-4o-mini',
        introduction: 'Context:\n',
        maxQuestionInput: 1,
        temperature: 0,
      });

      expect(answer.question).toBe('what is the answer?');
      expect(answer.answer).toBe('42');
      expect(answer.relevantInput).toEqual([records[0]]);
    });

    it('returns an empty answer when the completion request fails', async () => {
      const { service, openai } = createService();
      openai.embeddings.create.mockResolvedValue({
        data: [{ embedding: [1, 0], index: 0, object: 'embedding' }],
      });
      openai.chat.completions.create.mockRejectedValue(new Error('boom'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      const answer = await service.ask('q', [], {
        model: 'gpt-4o-mini',
        introduction: '',
        maxQuestionInput: 1,
        temperature: 0,
      });

      expect(answer.answer).toBe('');
    });
  });
});

const embeddingResponse = (...vectors: number[][]) => ({
  data: vectors.map((embedding, index) => ({
    embedding,
    index,
    object: 'embedding',
  })),
});

const embeddingOptions = {
  model: 'text-embedding-ada-002',
  maxTokensPerTextChunk: 1000,
  tokenRatio: 1,
};

describe('OpenAiService (more)', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('summarize', () => {
    it('logs the response status and data of an API error and resolves undefined', async () => {
      const { service, openai } = createService();
      openai.chat.completions.create.mockRejectedValue({
        response: { status: 429, data: 'rate limited' },
      });

      await expect(
        service.summarize('s', 't', { model: 'gpt-4o-mini', temperature: 0 }),
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(429);
      expect(errorSpy).toHaveBeenCalledWith('rate limited');
    });

    it('logs the message of a non-API error and resolves undefined', async () => {
      const { service, openai } = createService();
      openai.chat.completions.create.mockRejectedValue(
        new Error('socket hang up'),
      );

      await expect(
        service.summarize('s', 't', { model: 'gpt-4o-mini', temperature: 0 }),
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith('socket hang up');
    });
  });

  describe('ask', () => {
    const records = [
      { id: 'far', text: 'far', embedding: [0, 1] },
      { id: 'near', text: 'near', embedding: [1, 0] },
      { id: 'mid', text: 'mid', embedding: [1, 1] },
    ];
    const options = {
      model: 'gpt-4o-mini',
      introduction: 'Context:\n',
      maxQuestionInput: 10,
      temperature: 0.2,
    };

    function askWith(
      overrides: Partial<typeof options & { numQuestionInput: number }> = {},
    ) {
      const { service, openai } = createService();
      openai.embeddings.create.mockResolvedValue(embeddingResponse([1, 0]));
      openai.chat.completions.create.mockResolvedValue(
        chatCompletion('answer'),
      );
      return {
        openai,
        answer: service.ask('why?', records, { ...options, ...overrides }),
      };
    }

    it('ranks records by cosine similarity to the question', async () => {
      const { answer } = askWith();

      expect((await answer).relevantInput.map((r) => r.id)).toEqual([
        'near',
        'mid',
        'far',
      ]);
    });

    it('builds the prompt from the introduction, the ranked records and the question', async () => {
      const { openai, answer } = askWith({ maxQuestionInput: 2 });
      await answer;

      expect(openai.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: 'You answer questions based on the information available.',
          },
          {
            role: 'user',
            content: 'Context:\nnear\nmid\n \n\n Question: why? \n\n',
          },
        ],
      });
    });

    it('prefers numQuestionInput over maxQuestionInput', async () => {
      const { answer } = askWith({ numQuestionInput: 1, maxQuestionInput: 3 });

      expect((await answer).relevantInput.map((r) => r.id)).toEqual(['near']);
    });

    it('gives each answer a unique id', async () => {
      const first = await askWith().answer;
      const second = await askWith().answer;

      expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(first.id).not.toBe(second.id);
    });

    it('logs the response of an API error and answers empty', async () => {
      const { service, openai } = createService();
      openai.embeddings.create.mockResolvedValue(embeddingResponse([1, 0]));
      openai.chat.completions.create.mockRejectedValue({
        response: { status: 500, data: 'oops' },
      });

      const answer = await service.ask('q', records, options);

      expect(answer.answer).toBe('');
      expect(errorSpy).toHaveBeenCalledWith(500);
      expect(errorSpy).toHaveBeenCalledWith('oops');
    });

    it('rejects with the embedding error when the question cannot be embedded', async () => {
      const { service, openai } = createService();
      const error = new Error('model not supported for embeddings');
      openai.embeddings.create.mockRejectedValue(error);

      await expect(service.ask('q', records, options)).rejects.toBe(error);
      expect(openai.chat.completions.create).not.toHaveBeenCalled();
    });
  });

  describe('genImage', () => {
    it('requests a base64 image and returns it as a data url', async () => {
      const { service, openai } = createService();
      openai.images.generate.mockResolvedValue({
        data: [{ b64_json: 'QUJD' }],
      });

      await expect(service.genImage('a cat')).resolves.toBe(
        'data:image/jpeg;base64,QUJD',
      );
      expect(openai.images.generate).toHaveBeenCalledWith({
        prompt: 'a cat',
        quality: 'hd',
        response_format: 'b64_json',
      });
    });

    it('passes the requested quality', async () => {
      const { service, openai } = createService();
      openai.images.generate.mockResolvedValue({ data: [{ b64_json: 'x' }] });

      await service.genImage('a cat', 'standard');

      expect(openai.images.generate.mock.calls[0][0].quality).toBe('standard');
    });

    it.each([
      ['no data', {}],
      ['empty data', { data: [] }],
      ['no b64_json', { data: [{ url: 'https://x' }] }],
    ])('throws when the response has %s', async (_, response) => {
      const { service, openai } = createService();
      openai.images.generate.mockResolvedValue(response);

      await expect(service.genImage('a cat')).rejects.toThrow(
        'Failed to generate image or received invalid response from OpenAI.',
      );
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('genEmbeddings', () => {
    it('maps each embedding back to its input text', async () => {
      const { service, openai } = createService();
      openai.embeddings.create.mockResolvedValue(embeddingResponse([1], [2]));

      const result = await service.genEmbeddings(
        ['a', 'b'],
        'text-embedding-3-small',
      );

      expect(openai.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: ['a', 'b'],
      });
      expect(result).toEqual([
        { id: expect.any(String), text: 'a', embedding: [1], error: undefined },
        { id: expect.any(String), text: 'b', embedding: [2], error: undefined },
      ]);
    });

    it('rejects with the API error when the call fails', async () => {
      const { service, openai } = createService();
      const error = new Error('rate limited');
      openai.embeddings.create.mockRejectedValue(error);

      await expect(service.genEmbeddings(['a'], 'm')).rejects.toBe(error);
    });

    it('treats a response without data as no embeddings', async () => {
      const { service, openai } = createService();
      openai.embeddings.create.mockResolvedValue({});

      await expect(service.genEmbeddings(['a'], 'm')).resolves.toEqual([]);
    });
  });

  describe('regenEmbedding', () => {
    it('keeps the record and replaces its embedding', async () => {
      const { service, openai } = createService();
      openai.embeddings.create.mockResolvedValue(embeddingResponse([0.5, 0.5]));
      const record = {
        id: 'r1',
        text: 'hello',
        embedding: [],
        error: 'old error',
      };

      await expect(service.regenEmbedding(record, 'm')).resolves.toEqual([
        { id: 'r1', text: 'hello', embedding: [0.5, 0.5], error: undefined },
      ]);
      expect(openai.embeddings.create).toHaveBeenCalledWith({
        model: 'm',
        input: ['hello'],
      });
    });

    it('rejects with the API error when the call fails', async () => {
      const { service, openai } = createService();
      const error = new Error('down');
      openai.embeddings.create.mockRejectedValue(error);

      await expect(
        service.regenEmbedding({ id: 'r1', text: 'hello', embedding: [] }, 'm'),
      ).rejects.toBe(error);
    });
  });

  describe('synthesizeFileObject', () => {
    it('builds a TFile', () => {
      const buffer = Buffer.from('x');

      expect(
        createService().service.synthesizeFileObject('a.txt', buffer),
      ).toEqual({
        originalname: 'a.txt',
        buffer,
      });
    });
  });

  describe('sanitizeContentAndSplitIntoSentences', () => {
    const { service } = createService();

    it('collapses whitespace, line breaks and NULs, then splits on ". "', () => {
      expect(
        service.sanitizeContentAndSplitIntoSentences(
          'First   one.\r\nSecond\u0000one. Third.  ',
        ),
      ).toEqual(['First one', 'Second one', 'Third']);
    });

    it('drops empty segments', () => {
      expect(service.sanitizeContentAndSplitIntoSentences('. . a. ')).toEqual([
        'a',
      ]);
    });

    it('accepts a custom delimiter', () => {
      expect(
        service.sanitizeContentAndSplitIntoSentences('a | b | c', ' | '),
      ).toEqual(['a', 'b', 'c']);
    });
  });

  describe('tokenizeTextAndPersistAsEmbedding', () => {
    it('returns [] and persists nothing for empty content', async () => {
      const { service, openai } = createService();
      const persister = jest.fn();

      await expect(
        service.tokenizeTextAndPersistAsEmbedding(
          '',
          persister,
          embeddingOptions,
        ),
      ).resolves.toEqual([]);
      expect(persister).not.toHaveBeenCalled();
      expect(openai.embeddings.create).not.toHaveBeenCalled();
    });

    it('persists each chunk with the embedding generated for it, using the embedding model', async () => {
      const { service, openai } = createService();
      openai.embeddings.create.mockResolvedValue(embeddingResponse([0.1, 0.2]));
      const persister = jest.fn().mockResolvedValue(undefined);

      await service.tokenizeTextAndPersistAsEmbedding(
        'One. Two. Three. Four',
        persister,
        embeddingOptions,
      );

      expect(persister).toHaveBeenCalledTimes(
        openai.embeddings.create.mock.calls.length,
      );
      openai.embeddings.create.mock.calls.forEach(([request], i) => {
        expect(request.model).toBe('text-embedding-ada-002');
        expect(persister.mock.calls[i][0]).toEqual([
          {
            id: expect.any(String),
            text: request.input[0],
            embedding: [0.1, 0.2],
            error: undefined,
          },
        ]);
      });
    });

    it('persists the chunk without an embedding, with the error, when the embedding call fails', async () => {
      const { service, openai } = createService();
      const error = new Error('down');
      openai.embeddings.create.mockRejectedValue(error);
      const persister = jest.fn().mockResolvedValue(undefined);

      await service.tokenizeTextAndPersistAsEmbedding(
        'One. Two',
        persister,
        embeddingOptions,
      );

      expect(persister).toHaveBeenCalled();
      persister.mock.calls.forEach(([records]) => {
        expect(records).toEqual([
          {
            id: expect.any(String),
            text: expect.any(String),
            embedding: [],
            error,
          },
        ]);
      });
      expect(errorSpy).toHaveBeenCalledWith(error);
    });

    it('persists every sentence', async () => {
      const { service, openai } = createService();
      openai.embeddings.create.mockResolvedValue(embeddingResponse([1]));
      const persister = jest.fn().mockResolvedValue(undefined);

      await service.tokenizeTextAndPersistAsEmbedding(
        'One. Two',
        persister,
        embeddingOptions,
      );

      const persisted = persister.mock.calls
        .flatMap(([records]) => records.map((r: any) => r.text))
        .join(' ');
      expect(persisted).toContain('One');
      expect(persisted).toContain('Two');
    });
  });

  describe('tokenizeTextAndPersistWithoutEmbedding', () => {
    it('returns [] and persists nothing for empty content', async () => {
      const { service } = createService();
      const persister = jest.fn();

      await expect(
        service.tokenizeTextAndPersistWithoutEmbedding(
          '',
          persister,
          embeddingOptions,
        ),
      ).resolves.toEqual([]);
      expect(persister).not.toHaveBeenCalled();
    });

    it('persists non-empty chunks one record at a time with no embedding and no API call', async () => {
      const { service, openai } = createService();
      const persister = jest.fn().mockResolvedValue(undefined);

      await service.tokenizeTextAndPersistWithoutEmbedding(
        'One. Two. Three. Four',
        persister,
        embeddingOptions,
      );

      expect(openai.embeddings.create).not.toHaveBeenCalled();
      persister.mock.calls.forEach(([records]) => {
        expect(records).toEqual([
          {
            id: expect.any(String),
            text: expect.stringMatching(/\S/),
            embedding: [],
            error: undefined,
          },
        ]);
      });
    });
  });

  describe('chunking', () => {
    const chunksFor = async (text: string, maxTokensPerTextChunk: number) => {
      const { service } = createService();
      const persister = jest.fn().mockResolvedValue(undefined);

      await service.tokenizeTextAndPersistWithoutEmbedding(text, persister, {
        ...embeddingOptions,
        maxTokensPerTextChunk,
      });

      return persister.mock.calls.map(([records]) => records[0].text);
    };

    it('persists a single-sentence input as one chunk', async () => {
      await expect(chunksFor('Only one sentence', 1000)).resolves.toEqual([
        'Only one sentence',
      ]);
    });

    it('groups every sentence, in order, into one chunk when they fit', async () => {
      await expect(chunksFor('One. Two. Three. Four', 1000)).resolves.toEqual([
        'One. Two. Three. Four',
      ]);
    });

    it('starts a new chunk with the sentence that would overflow the limit', async () => {
      await expect(chunksFor('One. Two. Three. Four', 1)).resolves.toEqual([
        'One',
        'Two',
        'Three',
        'Four',
      ]);
    });

    it('keeps a sentence longer than the limit as its own chunk', async () => {
      await expect(
        chunksFor('This sentence is far longer than the limit. Two', 2),
      ).resolves.toEqual(['This sentence is far longer than the limit', 'Two']);
    });
  });

  describe('file ingestion', () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'open-ai-spec-'));
    });

    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    const methods = ['post', 'destructureFileAndPersistSegments'] as const;

    function captureExtraction(result: () => Promise<string>) {
      const seen: { path: string; content: string }[] = [];
      jest.mocked(extractText).mockImplementation(async (p) => {
        seen.push({ path: p, content: readFileSync(p, 'utf8') });
        return result();
      });
      return seen;
    }

    it('post writes the upload to a temp file, extracts it, persists embeddings and deletes the file', async () => {
      const { service, openai } = createService();
      const seen = captureExtraction(async () => 'One. Two. Three');
      openai.embeddings.create.mockResolvedValue(embeddingResponse([1]));
      const persister = jest.fn().mockResolvedValue(undefined);

      await service.post(
        service.synthesizeFileObject('doc.txt', Buffer.from('raw upload')),
        persister,
        embeddingOptions,
      );

      expect(seen).toHaveLength(1);
      expect(seen[0].content).toBe('raw upload');
      expect(dirname(dirname(seen[0].path))).toBe(tmpdir());
      expect(extname(seen[0].path)).toBe('.txt');
      expect(openai.embeddings.create).toHaveBeenCalled();
      expect(persister).toHaveBeenCalled();
      expect(existsSync(dirname(seen[0].path))).toBe(false);
    });

    it('destructureFileAndPersistSegments persists without embeddings and deletes the file', async () => {
      const { service, openai } = createService();
      const seen = captureExtraction(async () => 'One. Two. Three');
      const persister = jest.fn().mockResolvedValue(undefined);

      await service.destructureFileAndPersistSegments(
        service.synthesizeFileObject('doc.pdf', Buffer.from('raw')),
        persister,
        embeddingOptions,
      );

      expect(openai.embeddings.create).not.toHaveBeenCalled();
      expect(extname(seen[0].path)).toBe('.pdf');
      expect(existsSync(dirname(seen[0].path))).toBe(false);
    });

    describe.each(methods)('%s with a hostile file name', (method) => {
      it.each([
        ['a relative traversal', '../../escaped.txt'],
        ['a backslash traversal', '..\\..\\escaped.txt'],
        ['an absolute path', 'ABSOLUTE'],
      ])(
        'ignores %s and writes only inside a private temp dir',
        async (_, name) => {
          const { service, openai } = createService();
          // run from dir/a/b so a traversal of two levels would land in dir
          const cwd = join(dir, 'a', 'b');
          mkdirSync(cwd, { recursive: true });
          const originalname =
            name === 'ABSOLUTE' ? join(dir, 'escaped.txt') : name;
          const seen = captureExtraction(async () => 'One. Two');
          openai.embeddings.create.mockResolvedValue(embeddingResponse([1]));
          const previousCwd = process.cwd();
          process.chdir(cwd);

          try {
            await service[method](
              service.synthesizeFileObject(originalname, Buffer.from('x')),
              jest.fn().mockResolvedValue(undefined),
              embeddingOptions,
            );
          } finally {
            process.chdir(previousCwd);
          }

          expect(seen).toHaveLength(1);
          expect(dirname(dirname(seen[0].path))).toBe(tmpdir());
          expect(basename(seen[0].path)).toBe('upload.txt');
          expect(readdirSync(dir)).toEqual(['a']);
          expect(readdirSync(cwd)).toEqual([]);
        },
      );

      it('drops an extension that is not plain alphanumeric', async () => {
        const { service } = createService();
        const seen = captureExtraction(async () => '');

        await service[method](
          service.synthesizeFileObject('doc.t$x', Buffer.from('x')),
          jest.fn(),
          embeddingOptions,
        );

        expect(basename(seen[0].path)).toBe('upload');
      });
    });

    it.each(['post', 'destructureFileAndPersistSegments'] as const)(
      '%s logs instead of throwing when extraction fails',
      async (method) => {
        const { service } = createService();
        const error = new Error('unsupported format');
        jest.mocked(extractText).mockRejectedValue(error);
        const persister = jest.fn();

        await expect(
          service[method](
            service.synthesizeFileObject('doc.bin', Buffer.from('x')),
            persister,
            embeddingOptions,
          ),
        ).resolves.toBeUndefined();

        expect(errorSpy).toHaveBeenCalledWith(error);
        expect(persister).not.toHaveBeenCalled();
        const [path] = jest.mocked(extractText).mock.lastCall!;
        expect(existsSync(dirname(path))).toBe(false);
      },
    );
  });
});

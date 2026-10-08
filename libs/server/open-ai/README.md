# @onivoro/server-open-ai

A NestJS wrapper around the `openai` SDK focused on text extraction, chunking, embeddings, and embedding-based question answering.

## Installation

```bash
npm install @onivoro/server-open-ai openai @dqbd/tiktoken any-text compute-cosine-similarity pdf-parse @nestjs/common
```

`openai`, `@dqbd/tiktoken`, `any-text`, `compute-cosine-similarity`, `pdf-parse` and `@nestjs/common` are peer dependencies. `@onivoro/server-common` (which provides `moduleFactory`) is a regular dependency and is installed automatically.

## Overview

This library provides:

- Text extraction from PDF (via `pdf-parse`) and other formats (via `any-text`)
- Sentence splitting and token-based chunking (via `@dqbd/tiktoken`)
- Embedding generation with a caller-supplied persister
- Question answering over embedded records ranked by cosine similarity
- Chat-completion summarization
- Image generation

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerOpenAiModule, ServerOpenAiConfig } from '@onivoro/server-open-ai';

const config = new ServerOpenAiConfig();
config.apiKey = process.env.OPENAI_API_KEY!;
config.organization = process.env.OPENAI_ORGANIZATION ?? ''; // optional

@Module({
  imports: [ServerOpenAiModule.configure(config)],
})
export class AppModule {}
```

`ServerOpenAiModule.configure(config)` provides `OpenAiService`, the `ServerOpenAiConfig` instance, and an `OpenAI` client (the default export of `openai`, used as its own injection token). The client gets `organization` only when it is non-empty.

## Configuration

`ServerOpenAiConfig` has two properties:

- `apiKey: string` - your OpenAI API key
- `organization: string` - your OpenAI organization ID (defaults to `''`, meaning none)

## OpenAiService

```typescript
import { Injectable } from '@nestjs/common';
import { OpenAiService } from '@onivoro/server-open-ai';

@Injectable()
export class DocumentService {
  constructor(private openAiService: OpenAiService) {}
}
```

The service exposes its dependencies as public properties `config: ServerOpenAiConfig` and `openai: OpenAI`, so you can call any SDK method directly through `openAiService.openai`.

### Document Processing

#### `post(file: TFile, persister, options: TEmbeddingOptions)`

Writes `file.buffer` to a temporary file, extracts its text with `extractText`, splits and chunks it, generates an embedding per chunk and calls `persister` once per chunk. The temporary file lives in a new private directory created with `fs.mkdtemp` under `os.tmpdir()` and is named `upload` plus the extension of `file.originalname` (only a plain alphanumeric extension such as `.pdf` or `.docx` is kept, since `extractText` picks the parser by extension). No other part of `file.originalname` is used, so names like `../../x` or absolute paths cannot write outside that directory. The directory is always removed, including when extraction or persistence fails. Errors are caught and logged with `console.error`; the method does not throw.

```typescript
import { TEmbeddingOptions, TOpenAiData } from '@onivoro/server-open-ai';

const file = openAiService.synthesizeFileObject('document.pdf', fileBuffer);

const persister = async (data: TOpenAiData[]) => {
  await repository.save(data);
};

const options: TEmbeddingOptions = {
  model: 'text-embedding-3-small',
  maxTokensPerTextChunk: 1000,
  tokenRatio: 0.8,
};

await openAiService.post(file, persister, options);
```

#### `destructureFileAndPersistSegments(file, persister, options)`

Same as `post`, but persists each chunk without calling the embeddings API (`embedding` is `[]`). `options.model` is still used to pick the tokenizer.

#### `synthesizeFileObject(originalname: string, buffer: any): TFile`

Builds a `TFile` (`{ originalname, buffer }`), the shape of a Multer upload.

### Text Processing

#### `sanitizeContentAndSplitIntoSentences(rawContents: string, sentenceDeliminator = '. '): string[]`

Collapses runs of whitespace, replaces NUL characters and line breaks with spaces, splits on `sentenceDeliminator`, trims, and drops empty entries.

```typescript
openAiService.sanitizeContentAndSplitIntoSentences('First one.  Second\r\none. Third');
// ['First one', 'Second one', 'Third']
```

#### `tokenizeTextAndPersistAsEmbedding(rawContents, persister, options)`

#### `tokenizeTextAndPersistWithoutEmbedding(rawContents, persister, options)`

The text half of `post` and `destructureFileAndPersistSegments`: split `rawContents` into sentences, group consecutive sentences, in order, into chunks of at most `maxTokensPerTextChunk * tokenRatio` tokens (counted with the tiktoken encoding for `options.model`; sentences in a chunk are joined with `. `), and call `persister` once per chunk. The first generates embeddings; if the embeddings call for a chunk fails, the error is logged and the chunk is still persisted with `embedding: []` and the error in `error`. The second does not call the API and skips blank chunks. Both return `[]` early when `rawContents` is empty. Every sentence lands in exactly one chunk: a sentence that would push the pending chunk over the limit starts the next chunk, and a single sentence longer than the limit becomes a chunk of its own (so that chunk exceeds the limit).

```typescript
await openAiService.tokenizeTextAndPersistAsEmbedding(pageText, persister, options);
```

### Embedding Generation

#### `genEmbeddings(input: string[], model: string): Promise<TOpenAiData[]>`

Calls `openai.embeddings.create` and maps each result to a `TOpenAiData` with a new UUID `id`. If the API call fails, the promise rejects with the SDK's error.

```typescript
const records = await openAiService.genEmbeddings(['Hello world', 'Another text'], 'text-embedding-3-small');
```

#### `regenEmbedding(aiData: TOpenAiData, model: string): Promise<TOpenAiData[]>`

Generates a new embedding for `aiData.text` and returns a one-element array with `aiData`'s fields plus the new `embedding` (and `error: undefined`, clearing any previous error). If the embeddings call fails, the promise rejects with the SDK's error.

```typescript
const [updated] = await openAiService.regenEmbedding(existingRecord, 'text-embedding-3-small');
```

### Question Answering

#### `ask(rawQuestion, records, options): Promise<TOpenAiAnswer>`

Options: `{ model: string; numQuestionInput?: number; introduction: string; maxQuestionInput: number; temperature: number }`.

Embeds the question, ranks `records` by cosine similarity to it, appends the text of the top `numQuestionInput || maxQuestionInput` records to `introduction`, adds the question, and sends the result to `openai.chat.completions.create`. `answer` is the content of the completion's first choice (`response.choices[0].message.content`); if the completion request fails, the error is logged and `answer` is `''`. If embedding the question fails, `ask` rejects with the embeddings error and no completion is requested. The same `model` is used for both the question embedding and the chat completion. See [Known Issues](#known-issues) before relying on this method.

```typescript
const answer = await openAiService.ask('What is our refund window?', records, {
  model: 'gpt-4o-mini',
  numQuestionInput: 5,
  introduction: 'Use the following information to answer the question:\n',
  maxQuestionInput: 10,
  temperature: 0.2,
});
// { id, question, answer, relevantInput: TOpenAiData[] }
```

### Summarization

#### `summarize(systemData: string, textToSummarize: string, options: { model: string; temperature: number }): Promise<any>`

Sends a system message and a user message to `openai.chat.completions.create` and resolves to the content of the first choice (`response.choices[0].message.content`). Errors are logged and the method resolves to `undefined`.

```typescript
const summary = await openAiService.summarize('You summarize text in three sentences.', longText, { model: 'gpt-4o-mini', temperature: 0.3 });
```

### Image Generation

#### `genImage(prompt: string, quality: 'hd' | 'standard' = 'hd'): Promise<string>`

Calls `openai.images.generate` with `response_format: 'b64_json'` and no `model`, and returns a `data:image/jpeg;base64,...` URL. Throws if the response has no `b64_json`.

```typescript
const dataUrl = await openAiService.genImage('A sunset over mountains', 'standard');
```

## extractText

`extractText(path: string): Promise<string>`

Files whose extension contains `pdf` are read with `pdf-parse`; everything else goes to `any-text`'s `getText`.

```typescript
import { extractText } from '@onivoro/server-open-ai';

const text = await extractText('/path/to/document.pdf');
```

## Types

```typescript
type TOpenAiData = {
  id: string;
  text: string;
  embedding: number[];
  error?: any;
};

type TOpenAiAnswer = {
  id: string;
  question: string;
  answer: string;
  relevantInput: TOpenAiData[];
};

type TEmbeddingOptions = {
  model: string; // embedding model; also selects the tiktoken encoding
  maxTokensPerTextChunk: number;
  tokenRatio: number; // chunk limit = maxTokensPerTextChunk * tokenRatio
};

type TFile = { originalname: string; buffer: any };
```

## Known Issues

These describe the current source:

- `ask` uses one `model` for both the question embedding and the chat completion, so no single model value works for both: a chat model makes the embeddings call fail (and `ask` rejects with that error), and an embedding model makes the completion call fail (`answer` is `''`).
- Chunking logs the chunk count and token total with `console.log`.

## License

MIT

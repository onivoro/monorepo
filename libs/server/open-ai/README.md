# @onivoro/server-open-ai

A specialized OpenAI integration library for NestJS applications focused on text embeddings, document processing, and semantic search functionality.

## Installation

```bash
npm install @onivoro/server-open-ai
```

## Overview

This library provides:
- Text extraction from various document formats
- OpenAI embedding generation and storage
- Semantic similarity search using cosine similarity
- Document tokenization with configurable chunk sizes
- Image generation via DALL-E
- Question-answering based on embedded documents

## Module Setup

```typescript
import { ServerOpenAiModule, ServerOpenAiConfig } from '@onivoro/server-open-ai';

const config = new ServerOpenAiConfig();
config.apiKey = process.env.OPENAI_API_KEY;
config.organization = process.env.OPENAI_ORGANIZATION; // optional

@Module({
  imports: [
    ServerOpenAiModule.configure(config)
  ]
})
export class AppModule {}
```

## Configuration

The `ServerOpenAiConfig` class has two properties:
- `apiKey: string` - Your OpenAI API key (required)
- `organization: string` - Your OpenAI organization ID (optional, defaults to empty string)

## Core Service

### OpenAiService

The main service provides document processing and embedding functionality:

```typescript
import { Injectable } from '@nestjs/common';
import { OpenAiService } from '@onivoro/server-open-ai';

@Injectable()
export class DocumentService {
  constructor(private openAiService: OpenAiService) {}
}
```

## API Reference

### Document Processing

#### `post(file, persister, options)`

Process a file, extract text, generate embeddings, and persist them:

```typescript
const file = {
  originalname: 'document.pdf',
  buffer: fileBuffer
};

const persister = async (data: TOpenAiData[]) => {
  // Save embeddings to your database
  await database.save(data);
};

const options: TEmbeddingOptions = {
  model: 'text-embedding-ada-002',
  maxTokensPerTextChunk: 1000,
  tokenRatio: 0.8
};

await openAiService.post(file, persister, options);
```

#### `destructureFileAndPersistSegments(file, persister, options)`

Process a file and persist text segments without generating embeddings:

```typescript
await openAiService.destructureFileAndPersistSegments(file, persister, options);
```

### Embedding Generation

#### `genEmbeddings(input, model)`

Generate embeddings for an array of text inputs:

```typescript
const embeddings = await openAiService.genEmbeddings(
  ['Hello world', 'Another text'],
  'text-embedding-ada-002'
);

// Returns TOpenAiData[] with structure:
// {
//   id: string;
//   text: string;
//   embedding: number[];
//   error?: any;
// }
```

#### `regenEmbedding(aiData, model)`

Regenerate embedding for existing data:

```typescript
const updatedData = await openAiService.regenEmbedding(existingData, 'text-embedding-ada-002');
```

### Question Answering

#### `ask(question, records, options)`

Find relevant embedded documents and generate an answer:

```typescript
const answer = await openAiService.ask(
  'What is the capital of France?',
  embeddedDocuments, // Array of TOpenAiData
  {
    model: 'gpt-3.5-turbo',
    numQuestionInput: 5,
    introduction: 'Based on the following information:\n',
    maxQuestionInput: 10,
    temperature: 0.7
  }
);

// Returns TOpenAiAnswer:
// {
//   id: string;
//   question: string;
//   answer: string;
//   relevantInput: TOpenAiData[];
// }
```

### Image Generation

#### `genImage(prompt, quality)`

Generate images using DALL-E:

```typescript
const base64Image = await openAiService.genImage(
  'A sunset over mountains',
  'hd' // or 'standard'
);
// Returns data URL: "data:image/jpeg;base64,..."
```

### Text Summarization

#### `summarize(systemData, textToSummarize, options)`

Summarize text using chat completions:

```typescript
const summary = await openAiService.summarize(
  'You are a helpful assistant that summarizes text concisely.',
  longText,
  {
    model: 'gpt-3.5-turbo',
    temperature: 0.3
  }
);
```

### Utility Functions

#### `extractText(filePath)`

Extract text from various file formats:

```typescript
import { extractText } from '@onivoro/server-open-ai';

const text = await extractText('/path/to/document.pdf');
```

Supported formats depend on the implementation but typically include PDF, DOCX, TXT, etc.

## Type Definitions

### TOpenAiData

```typescript
interface TOpenAiData {
  id: string;
  text: string;
  embedding: number[];
  error?: any;
}
```

### TOpenAiAnswer

```typescript
interface TOpenAiAnswer {
  id: string;
  question: string;
  answer: string;
  relevantInput: TOpenAiData[];
}
```

### TEmbeddingOptions

```typescript
interface TEmbeddingOptions {
  model: string;                // e.g., 'text-embedding-ada-002'
  maxTokensPerTextChunk: number; // Maximum tokens per chunk
  tokenRatio: number;           // Ratio for token calculation (0-1)
}
```

## Complete Example

```typescript
import { Injectable } from '@nestjs/common';
import { OpenAiService, TOpenAiData, TEmbeddingOptions } from '@onivoro/server-open-ai';

@Injectable()
export class KnowledgeBaseService {
  private embeddedDocuments: TOpenAiData[] = [];

  constructor(private openAiService: OpenAiService) {}

  async indexDocument(fileBuffer: Buffer, filename: string) {
    const file = {
      originalname: filename,
      buffer: fileBuffer
    };

    const persister = async (data: TOpenAiData[]) => {
      this.embeddedDocuments.push(...data);
      // Also save to database
    };

    const options: TEmbeddingOptions = {
      model: 'text-embedding-ada-002',
      maxTokensPerTextChunk: 1000,
      tokenRatio: 0.8
    };

    await this.openAiService.post(file, persister, options);
  }

  async searchDocuments(query: string) {
    const answer = await this.openAiService.ask(
      query,
      this.embeddedDocuments,
      {
        model: 'gpt-3.5-turbo',
        numQuestionInput: 5,
        introduction: 'Use the following information to answer the question:\n\n',
        maxQuestionInput: 10,
        temperature: 0.7
      }
    );

    return {
      answer: answer.answer,
      sources: answer.relevantInput.map(input => ({
        text: input.text,
        similarity: answer.relevantInput.indexOf(input)
      }))
    };
  }
}
```

## Important Notes

1. This library is specifically designed for embedding-based workflows, not general OpenAI API usage
2. The `post` method writes files to disk temporarily during processing
3. Text is automatically chunked based on token limits before embedding
4. Embeddings use cosine similarity for relevance ranking
5. The library includes automatic sentence splitting and normalization

## License

MIT
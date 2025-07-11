# @onivoro/server-open-ai

A comprehensive OpenAI integration library for NestJS applications, providing text extraction, embedding generation, and AI-powered services with built-in configuration management and type safety.

## Installation

```bash
npm install @onivoro/server-open-ai
```

## Features

- **OpenAI Service**: Complete OpenAI API integration with GPT models
- **Text Extraction**: Advanced text extraction from various document formats
- **Embedding Generation**: Vector embeddings for semantic search and similarity
- **Configuration Management**: Strongly-typed configuration with environment variables
- **NestJS Module**: Ready-to-use module with dependency injection
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Error Handling**: Robust error handling for API calls and processing
- **Flexible Options**: Configurable embedding and processing options

## Quick Start

### Import the Module

```typescript
import { ServerOpenAiModule } from '@onivoro/server-open-ai';

@Module({
  imports: [ServerOpenAiModule],
})
export class AppModule {}
```

### Basic Configuration

```typescript
import { ServerOpenAiConfig } from '@onivoro/server-open-ai';

// Environment variables
// OPENAI_API_KEY=your_openai_api_key
// OPENAI_BASE_URL=https://api.openai.com/v1 (optional)
// OPENAI_MODEL=gpt-4 (optional)
```

### Using the OpenAI Service

```typescript
import { Injectable } from '@nestjs/common';
import { OpenAiService } from '@onivoro/server-open-ai';

@Injectable()
export class MyService {
  constructor(private openAiService: OpenAiService) {}

  async generateText(prompt: string): Promise<string> {
    const response = await this.openAiService.generateCompletion({
      prompt,
      maxTokens: 100,
      temperature: 0.7
    });
    return response.text;
  }

  async createEmbedding(text: string): Promise<number[]> {
    const embedding = await this.openAiService.createEmbedding({
      text,
      model: 'text-embedding-3-small'
    });
    return embedding.data[0].embedding;
  }
}
```

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-your-openai-api-key

# Optional
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_MAX_TOKENS=1000
OPENAI_TEMPERATURE=0.7
```

### Configuration Class

```typescript
import { ServerOpenAiConfig, EnvironmentClass } from '@onivoro/server-open-ai';

@EnvironmentClass()
export class CustomOpenAiConfig extends ServerOpenAiConfig {
  @EnvironmentVariable('CUSTOM_OPENAI_SETTING')
  customSetting: string;
}
```

## Usage Examples

### Text Generation

```typescript
import { OpenAiService, OpenAiAnswer } from '@onivoro/server-open-ai';

@Injectable()
export class ContentService {
  constructor(private openAiService: OpenAiService) {}

  async generateArticle(topic: string): Promise<OpenAiAnswer> {
    return this.openAiService.generateCompletion({
      prompt: `Write a comprehensive article about ${topic}`,
      maxTokens: 1000,
      temperature: 0.8,
      model: 'gpt-4'
    });
  }

  async summarizeText(text: string): Promise<string> {
    const response = await this.openAiService.generateCompletion({
      prompt: `Summarize the following text: ${text}`,
      maxTokens: 150,
      temperature: 0.3
    });
    return response.text;
  }
}
```

### Embedding Generation

```typescript
import { OpenAiService, EmbeddingOptions } from '@onivoro/server-open-ai';

@Injectable()
export class SearchService {
  constructor(private openAiService: OpenAiService) {}

  async createDocumentEmbeddings(documents: string[]): Promise<number[][]> {
    const embeddings = await Promise.all(
      documents.map(doc => this.openAiService.createEmbedding({
        text: doc,
        model: 'text-embedding-3-small'
      }))
    );
    
    return embeddings.map(embedding => embedding.data[0].embedding);
  }

  async findSimilarDocuments(query: string, documentEmbeddings: number[][]): Promise<number[]> {
    const queryEmbedding = await this.openAiService.createEmbedding({
      text: query,
      model: 'text-embedding-3-small'
    });
    
    // Calculate similarity scores
    const similarities = documentEmbeddings.map((docEmbedding, index) => ({
      index,
      similarity: this.calculateCosineSimilarity(
        queryEmbedding.data[0].embedding,
        docEmbedding
      )
    }));
    
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .map(item => item.index);
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
```

### Text Extraction

```typescript
import { extractText } from '@onivoro/server-open-ai';

@Injectable()
export class DocumentService {
  async processDocument(filePath: string): Promise<string> {
    try {
      const extractedText = await extractText(filePath);
      return extractedText;
    } catch (error) {
      throw new Error(`Failed to extract text from ${filePath}: ${error.message}`);
    }
  }

  async extractAndEmbedDocument(filePath: string): Promise<{
    text: string;
    embedding: number[];
  }> {
    const text = await extractText(filePath);
    const embeddingResponse = await this.openAiService.createEmbedding({
      text,
      model: 'text-embedding-3-small'
    });
    
    return {
      text,
      embedding: embeddingResponse.data[0].embedding
    };
  }
}
```

### Advanced Usage with Custom Options

```typescript
import { OpenAiService, EmbeddingOptions, OpenAiData } from '@onivoro/server-open-ai';

@Injectable()
export class AdvancedAiService {
  constructor(private openAiService: OpenAiService) {}

  async generateWithCustomOptions(prompt: string): Promise<OpenAiAnswer> {
    const customOptions: OpenAiData = {
      prompt,
      model: 'gpt-4-turbo',
      maxTokens: 2000,
      temperature: 0.9,
      topP: 0.9,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      stop: ['END', 'STOP']
    };

    return this.openAiService.generateCompletion(customOptions);
  }

  async batchEmbeddingGeneration(texts: string[]): Promise<number[][]> {
    const batchSize = 10;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map(text => this.openAiService.createEmbedding({
          text,
          model: 'text-embedding-3-small'
        }))
      );
      
      embeddings.push(...batchEmbeddings.map(e => e.data[0].embedding));
    }

    return embeddings;
  }

  async chatCompletion(messages: Array<{role: string; content: string}>): Promise<string> {
    const response = await this.openAiService.createChatCompletion({
      model: 'gpt-4',
      messages,
      maxTokens: 1000,
      temperature: 0.7
    });

    return response.choices[0].message.content;
  }
}
```

### Error Handling

```typescript
import { OpenAiService } from '@onivoro/server-open-ai';
import { HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class SafeAiService {
  constructor(private openAiService: OpenAiService) {}

  async safeGeneration(prompt: string): Promise<string> {
    try {
      const response = await this.openAiService.generateCompletion({
        prompt,
        maxTokens: 500,
        temperature: 0.7
      });
      
      return response.text;
    } catch (error) {
      if (error.response?.status === 429) {
        throw new HttpException(
          'Rate limit exceeded. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
      
      if (error.response?.status === 401) {
        throw new HttpException(
          'Invalid API key configuration.',
          HttpStatus.UNAUTHORIZED
        );
      }
      
      throw new HttpException(
        'Failed to generate text.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
```

## API Reference

### OpenAiService

Main service for OpenAI API interactions:

```typescript
@Injectable()
export class OpenAiService {
  async generateCompletion(options: OpenAiData): Promise<OpenAiAnswer>
  async createEmbedding(options: EmbeddingOptions): Promise<EmbeddingResponse>
  async createChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse>
}
```

### Configuration

#### ServerOpenAiConfig

Configuration class for OpenAI settings:

```typescript
@EnvironmentClass()
export class ServerOpenAiConfig {
  @EnvironmentVariable('OPENAI_API_KEY')
  apiKey: string;

  @EnvironmentVariable('OPENAI_BASE_URL', 'https://api.openai.com/v1')
  baseUrl: string;

  @EnvironmentVariable('OPENAI_MODEL', 'gpt-3.5-turbo')
  model: string;

  @EnvironmentVariable('OPENAI_MAX_TOKENS', '1000')
  maxTokens: number;

  @EnvironmentVariable('OPENAI_TEMPERATURE', '0.7')
  temperature: number;
}
```

### Type Definitions

#### OpenAiData

Options for text generation:

```typescript
interface OpenAiData {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
}
```

#### OpenAiAnswer

Response from text generation:

```typescript
interface OpenAiAnswer {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  choices: Array<{
    text: string;
    index: number;
    finishReason: string;
  }>;
}
```

#### EmbeddingOptions

Options for embedding generation:

```typescript
interface EmbeddingOptions {
  text: string;
  model?: string;
  dimensions?: number;
}
```

### Functions

#### extractText

Extract text from various document formats:

```typescript
async function extractText(filePath: string): Promise<string>
```

Supported formats:
- PDF documents
- Microsoft Word documents
- Plain text files
- HTML files
- Markdown files

## Best Practices

1. **API Key Security**: Store API keys securely using environment variables
2. **Rate Limiting**: Implement rate limiting to avoid API quota issues
3. **Error Handling**: Always handle API errors gracefully
4. **Token Management**: Monitor token usage to control costs
5. **Model Selection**: Choose appropriate models for your use case
6. **Caching**: Cache embeddings and responses when possible
7. **Batch Processing**: Use batch processing for multiple operations
8. **Monitoring**: Monitor API usage and performance

## Testing

```typescript
import { Test } from '@nestjs/testing';
import { ServerOpenAiModule, OpenAiService } from '@onivoro/server-open-ai';

describe('OpenAiService', () => {
  let service: OpenAiService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ServerOpenAiModule],
    }).compile();

    service = module.get<OpenAiService>(OpenAiService);
  });

  it('should generate text completion', async () => {
    const result = await service.generateCompletion({
      prompt: 'Hello, world!',
      maxTokens: 10
    });
    
    expect(result.text).toBeDefined();
    expect(result.usage.totalTokens).toBeGreaterThan(0);
  });

  it('should create embeddings', async () => {
    const result = await service.createEmbedding({
      text: 'Sample text for embedding'
    });
    
    expect(result.data[0].embedding).toBeDefined();
    expect(result.data[0].embedding.length).toBeGreaterThan(0);
  });
});
```

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.
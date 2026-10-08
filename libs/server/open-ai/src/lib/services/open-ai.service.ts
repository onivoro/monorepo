import { Injectable } from '@nestjs/common';
import { extractText } from '../functions/extract-text.function';
import OpenAIApi from 'openai';
import { encoding_for_model, TiktokenModel } from '@dqbd/tiktoken';
import similarity from 'compute-cosine-similarity';
import { TOpenAiAnswer } from '../types/open-ai-answer.type';
import { TOpenAiData } from '../types/open-ai-data.type';
import { ServerOpenAiConfig } from '../server-open-ai-config.class';
import { randomUUID as v4 } from 'node:crypto';
import { APIPromise } from 'openai';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { TEmbeddingOptions } from '../types/embedding-options.type';
import { ChatCompletion } from 'openai/resources/chat/completions/completions';
import { Embedding } from 'openai/resources/embeddings';

export type TFile = { originalname: string; buffer: any };

@Injectable()
export class OpenAiService {
  constructor(
    public config: ServerOpenAiConfig,
    public openai: OpenAIApi,
  ) {}

  async post(
    file: TFile,
    persister: (data: TOpenAiData[]) => Promise<void>,
    _: TEmbeddingOptions,
  ) {
    try {
      await this.withTempFile(file, async (path) => {
        const contents = await extractText(path);

        await this.tokenizeTextAndPersistAsEmbedding(contents, persister, _);
      });
    } catch (error: any) {
      console.error(error);
    }
  }

  async destructureFileAndPersistSegments(
    file: TFile,
    persister: (data: TOpenAiData[]) => Promise<void>,
    _: TEmbeddingOptions,
  ) {
    try {
      await this.withTempFile(file, async (path) => {
        const contents = await extractText(path);

        await this.tokenizeTextAndPersistWithoutEmbedding(
          contents,
          persister,
          _,
        );
      });
    } catch (error: any) {
      console.error(error);
    }
  }

  async tokenizeTextAndPersistWithoutEmbedding(
    rawContents: string,
    persister: (data: TOpenAiData[]) => Promise<void>,
    _: TEmbeddingOptions,
  ) {
    if (!rawContents) {
      return [];
    }

    const sentences = this.sanitizeContentAndSplitIntoSentences(rawContents);

    const lengthNormalizedSentences = this.normalizeLength(sentences, _);

    for await (const sentence of lengthNormalizedSentences) {
      if (sentence?.trim()) {
        const records: TOpenAiData[] = [this.embeddingToDataModel(sentence)];

        await persister(records);
      }
    }
  }

  sanitizeContentAndSplitIntoSentences(
    rawContents: string,
    sentenceDeliminator = '. ',
  ) {
    return rawContents
      .replaceAll(/\s{2,}/g, ' ')
      .replaceAll('\u0000', ' ')
      .replaceAll(/(\r\n|\n|\r)/gm, ' ')
      .split(sentenceDeliminator)
      .map((_) => _.trim())
      .filter((_) => !!_);
    // todo: change to use .match(/[^.!?]+[.!?]+/g)
    // todo: add configurable hook here to sanitize contents
  }

  async tokenizeTextAndPersistAsEmbedding(
    rawContents: string,
    persister: (data: TOpenAiData[]) => Promise<void>,
    _: TEmbeddingOptions,
  ) {
    if (!rawContents) {
      return [];
    }

    const sentences = this.sanitizeContentAndSplitIntoSentences(rawContents);

    const lengthNormalizedSentences = this.normalizeLength(sentences, _);

    for await (const sentence of lengthNormalizedSentences) {
      let errorEncountered = false;
      let records: TOpenAiData[];

      // todo: make this code more concise and readable
      try {
        records = errorEncountered
          ? [this.embeddingToDataModel(sentence)]
          : await this.genEmbeddings([sentence], _.model);
      } catch (error: any) {
        errorEncountered = true;
        console.error(error);
        records = [this.embeddingToDataModel(sentence, undefined, error)];
      }

      await persister(records);
    }
  }

  async summarize(
    systemData: string,
    textToSummarize: string,
    _: { model: string; temperature: number },
  ): Promise<any> {
    const { model, temperature } = _;
    let response: APIPromise<ChatCompletion>;
    const messages = [
      {
        role: 'system' as any,
        content: systemData,
      },
      { role: 'user', content: textToSummarize },
    ];
    try {
      response = (await this.openai.chat.completions.create({
        model,
        messages,
        temperature,
      })) as any;
      return (response as any)['choices'][0]['message']['content'];
    } catch (error: any) {
      if (error.response) {
        console.error(error.response.status);
        console.error(error.response.data);
      } else {
        console.error(error.message);
      }
    }
  }

  async ask(
    rawQuestion: string,
    records: TOpenAiData[],
    _: {
      model: string;
      numQuestionInput?: number;
      introduction: string;
      maxQuestionInput: number;
      temperature: number;
    },
  ): Promise<TOpenAiAnswer> {
    const {
      model,
      numQuestionInput,
      introduction,
      maxQuestionInput,
      temperature,
    } = _;
    const modelToUse = model;
    const question = ` \n\n Question: ${rawQuestion} \n\n`;
    const questionEmbeddingData = await this.genEmbeddings(
      [rawQuestion],
      model,
    );
    const questionEmbedding = questionEmbeddingData[0]['embedding'];
    const recordEmbeddings = records.map((input) => ({
      similarity: similarity(input.embedding, questionEmbedding),
      text: input.text,
      input,
    }));
    recordEmbeddings.sort(
      (a, b) => (b?.similarity || 0) - (a?.similarity || 0),
    );
    let message = introduction;
    const iterations = Math.min(
      numQuestionInput || maxQuestionInput,
      recordEmbeddings.length,
    );
    const relevantInput = [];
    for (let x = 1; x <= iterations; x++) {
      const recordEmbedding = recordEmbeddings[x - 1];
      message += recordEmbedding.text + '\n';
      relevantInput.push(recordEmbedding.input);
    }
    message += question;
    const messages = [
      {
        role: 'system' as any,
        content: 'You answer questions based on the information available.',
      },
      { role: 'user', content: message },
    ];
    let response: APIPromise<ChatCompletion> | null = null;
    try {
      response = (await this.openai.chat.completions.create({
        model: modelToUse,
        messages,
        temperature,
      })) as any;
    } catch (error: any) {
      if (error.response) {
        console.error(error.response.status);
        console.error(error.response.data);
      } else {
        console.error(error.message);
      }
    }
    const answer: TOpenAiAnswer = {
      id: v4(),
      question: rawQuestion,
      answer: response
        ? (response as any)['choices'][0]['message']['content']
        : '',
      relevantInput,
    };

    return answer;
  }

  async genImage(prompt: string, quality: 'hd' | 'standard' = 'hd') {
    const response = await this.openai.images.generate({
      prompt,
      quality,
      response_format: 'b64_json',
    });

    if (
      response.data &&
      response.data.length > 0 &&
      response.data[0].b64_json
    ) {
      const base64 = response.data[0].b64_json;
      return `data:image/jpeg;base64,${base64}`;
    } else {
      console.error(
        'Invalid response or missing b64_json in OpenAI image generation response:',
        response,
      );
      throw new Error(
        'Failed to generate image or received invalid response from OpenAI.',
      );
    }
  }

  async genEmbeddings(input: string[], model: string): Promise<TOpenAiData[]> {
    const response = await this.openai.embeddings.create({
      model,
      input,
    });

    const embeddings: Embedding[] = response.data || [];

    return embeddings.map((embedding, index) =>
      this.embeddingToDataModel(input[index], embedding),
    );
  }

  async regenEmbedding(
    aiData: TOpenAiData,
    model: string,
  ): Promise<TOpenAiData[]> {
    const { embedding, error } = (
      await this.genEmbeddings([aiData.text], model)
    )[0];

    return [{ ...aiData, embedding, error }];
  }

  synthesizeFileObject(originalname: string, buffer: any): TFile {
    return {
      originalname,
      buffer,
    } as TFile;
  }

  private normalizeLength(sentences: string[], _: TEmbeddingOptions) {
    const { model, maxTokensPerTextChunk, tokenRatio } = _;
    const enc = encoding_for_model(model as TiktokenModel);
    const normalizedLengthGroups: string[] = [];

    const limit = maxTokensPerTextChunk * tokenRatio;
    let aggregatedText = '';
    let tokenTotal = 0;

    const pushChunk = (text: string) => {
      tokenTotal += enc.encode(text).length;
      normalizedLengthGroups.push(text);
    };

    for (const sentence of sentences) {
      const newAggregatedText = aggregatedText
        ? `${aggregatedText}. ${sentence}`
        : sentence;
      const isOverLimit = enc.encode(newAggregatedText).length > limit;

      // a sentence that does not fit closes the pending chunk and starts the next one;
      // a sentence longer than the limit on its own still becomes its own chunk
      if (isOverLimit && aggregatedText) {
        pushChunk(aggregatedText);
        aggregatedText = sentence;
      } else {
        aggregatedText = newAggregatedText;
      }
    }

    if (aggregatedText) {
      pushChunk(aggregatedText);
    }

    enc.free();

    // todo: add the aggregated token count to the individual records instead of logging it out here
    console.log(normalizedLengthGroups.length, tokenTotal);

    return normalizedLengthGroups;
  }

  private embeddingToDataModel(
    text: string,
    embeddingResponse?: Embedding,
    error?: any,
  ) {
    const { embedding } = embeddingResponse || { embedding: [] };

    return {
      id: v4(),
      text,
      embedding,
      error,
    };
  }

  // the upload is written to a fresh private temp directory under a fixed name; only a
  // plain alphanumeric extension is taken from originalname because extractText picks the
  // parser by extension. the directory is always removed, even when extraction fails.
  private async withTempFile<T>(
    file: TFile,
    fn: (path: string) => Promise<T>,
  ): Promise<T> {
    const dir = await mkdtemp(join(tmpdir(), 'onivoro-open-ai-'));
    try {
      const path = join(dir, `upload${this.safeExtension(file.originalname)}`);
      await writeFile(path, file.buffer);
      return await fn(path);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private safeExtension(originalname: string) {
    const ext = extname(basename(String(originalname ?? '')));
    return /^\.[A-Za-z0-9]{1,16}$/.test(ext) ? ext : '';
  }
}

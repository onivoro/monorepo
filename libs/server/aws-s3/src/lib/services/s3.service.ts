import { BadRequestException, Injectable } from '@nestjs/common';
import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, PutObjectCommandOutput, PutObjectRequest, S3, S3Client } from '@aws-sdk/client-s3';
import { ServerAwsS3Config } from '../server-aws-s3-config.class';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IS3UploadResponse } from '../interfaces/s3-upload-response.interface';
import { resolveUrl } from '../functions/resolve-url.function';
import { createInterface, ReadLineOptions } from 'node:readline/promises';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export type TS3Params = {
  Key: string,
  Bucket?: string | null | undefined
};

export type TS3PrefixParams = Omit<TS3Params, 'Key'> & {
  Prefix: string;
};

export type TS3ObjectsParams = Omit<TS3Params, 'Key'> & {
  Objects: { Key: string }[];
};

export type TStreamFromS3Options<T = unknown> = Omit<ReadLineOptions, 'input'> & {
  Bucket?: string;
  skipEmptyLines?: boolean;
  parser?: (line: string) => T;
};

@Injectable()
export class S3Service {
  constructor(private config: ServerAwsS3Config, private s3: S3Client) { }

  async upload(params: TS3Params & { Body: PutObjectRequest['Body'], ACL?: PutObjectRequest['ACL'], ContentType?: PutObjectRequest['ContentType'] }): Promise<IS3UploadResponse> {
    // todo: sanitize filename here before uploading
    const resolvedParams = this.addDefaultBucket(params);
    const command = new PutObjectCommand(this.addDefaultBucket(resolvedParams));
    const { ETag } = await this.s3.send(command);
    const Location = resolveUrl(this.config.AWS_REGION, resolvedParams);

    return {
      Location,
      ...resolvedParams,
      ETag,
    };
  }

  /**
   * Streams a file from S3 line by line as an async generator.
   * By default, parses each line as JSON and skips empty lines.
   * Use the `parser` option for custom parsing.
   *
   * @param s3FileKey - The S3 object key
   * @param options - Stream options including readline and custom parsing options
   * @param options.skipEmptyLines - Skip empty lines (default: true)
   * @yields Parsed records of type T
   *
   * @example
   * // Stream JSON lines (default)
   * for await (const record of s3Service.streamFromS3<User>('users.jsonl')) {
   *   console.log(record.name);
   * }
   *
   * @example
   * // Stream with custom parser
   * for await (const row of s3Service.streamFromS3<string[]>('data.csv', {
   *   parser: (line) => line.split(','),
   * })) {
   *   console.log(row);
   * }
   *
   * @example
   * // Stream raw lines without parsing
   * for await (const line of s3Service.streamFromS3<string>('log.txt', {
   *   parser: (line) => line,
   * })) {
   *   console.log(line);
   * }
   *
   * @example
   * // Stream from alternate bucket with AbortSignal
   * const controller = new AbortController();
   * for await (const record of s3Service.streamFromS3<Event>('events.jsonl', {
   *   Bucket: 'other-bucket',
   *   signal: controller.signal,
   * })) {
   *   if (shouldStop) controller.abort();
   * }
   */
  async *streamFromS3<T>(s3FileKey: string, options?: TStreamFromS3Options<T>) {
    const { Bucket, skipEmptyLines = true, parser, ...readlineOptions } = options ?? {};

    const result = await this.getFile({
      Key: s3FileKey,
      Bucket,
    });

    if (!(result.Body instanceof Readable)) {
      throw new Error(
        `File not readable -> key:${s3FileKey}, type:${Object.getPrototypeOf(
          result.Body
        )}`
      );
    }

    const rl = createInterface({
      crlfDelay: Infinity,
      ...readlineOptions,
      input: result.Body,
    });

    try {
      const parse = parser ?? ((line: string) => JSON.parse(line) as T);

      for await (const line of rl) {
        if (skipEmptyLines && !line.trim()) continue;
        yield parse(line);
      }
    } finally {
      rl.close();
      result.Body.destroy();
    }
  }

  /**
   * Streams raw text lines from S3 without parsing.
   *
   * @example
   * for await (const line of s3Service.streamLinesFromS3('logs/app.log')) {
   *   console.log(line);
   * }
   */
  async *streamLinesFromS3(s3FileKey: string, options?: Omit<TStreamFromS3Options<string>, 'parser'>) {
    yield* this.streamFromS3<string>(s3FileKey, {
      ...options,
      parser: (line) => line,
    });
  }

  /**
   * Streams CSV rows from S3 as string arrays.
   * Note: This is a simple implementation that splits on comma. For complex CSVs
   * with quoted fields, provide a custom parser or use a CSV library.
   *
   * @param s3FileKey - The S3 object key
   * @param options - Additional options. Use `skipHeader: true` to skip the first row.
   *
   * @example
   * for await (const [name, email, age] of s3Service.streamCsvFromS3('users.csv', { skipHeader: true })) {
   *   console.log({ name, email, age });
   * }
   */
  async *streamCsvFromS3(
    s3FileKey: string,
    options?: Omit<TStreamFromS3Options<string[]>, 'parser'> & { skipHeader?: boolean; delimiter?: string }
  ) {
    const { skipHeader, delimiter = ',', ...rest } = options ?? {};
    let isFirst = true;

    for await (const row of this.streamFromS3<string[]>(s3FileKey, {
      ...rest,
      skipEmptyLines: true,
      parser: (line) => line.split(delimiter),
    })) {
      if (isFirst && skipHeader) {
        isFirst = false;
        continue;
      }
      isFirst = false;
      yield row;
    }
  }

  /**
   * Collects all records from an S3 file into an array.
   * Use `limit` to cap the number of records returned.
   *
   * @example
   * // Collect all records
   * const users = await s3Service.collectFromS3<User>('users.jsonl');
   *
   * @example
   * // Collect first 100 records
   * const sample = await s3Service.collectFromS3<User>('users.jsonl', { limit: 100 });
   */
  async collectFromS3<T>(
    s3FileKey: string,
    options?: TStreamFromS3Options<T> & { limit?: number }
  ): Promise<T[]> {
    const { limit, ...streamOptions } = options ?? {};
    const results: T[] = [];

    for await (const record of this.streamFromS3<T>(s3FileKey, streamOptions)) {
      results.push(record);
      if (limit && results.length >= limit) break;
    }

    return results;
  }

  /**
   * Processes each record from an S3 file with a callback function.
   * Useful for batch processing with side effects.
   *
   * @param s3FileKey - The S3 object key
   * @param callback - Async function called for each record
   * @param options - Stream options
   * @returns The total count of processed records
   *
   * @example
   * const count = await s3Service.forEachFromS3<User>('users.jsonl', async (user, index) => {
   *   await db.upsert(user);
   *   if (index % 1000 === 0) console.log(`Processed ${index} records`);
   * });
   * console.log(`Total: ${count}`);
   */
  async forEachFromS3<T>(
    s3FileKey: string,
    callback: (record: T, index: number) => Promise<void> | void,
    options?: TStreamFromS3Options<T>
  ): Promise<number> {
    let index = 0;

    for await (const record of this.streamFromS3<T>(s3FileKey, options)) {
      await callback(record, index++);
    }

    return index;
  }

  /**
   * Pipes raw S3 file content directly to a writable stream.
   * Useful for streaming to child processes, file writes, or HTTP responses.
   *
   * @param s3FileKey - The S3 object key
   * @param destination - Writable stream (e.g., process.stdin, fs.createWriteStream, res)
   * @param options - Optional bucket override
   *
   * @example
   * // Pipe to a child process
   * const child = spawn('wc', ['-l']);
   * await s3Service.pipeFromS3('large-file.txt', child.stdin);
   *
   * @example
   * // Pipe to a file
   * const fileStream = fs.createWriteStream('/tmp/output.txt');
   * await s3Service.pipeFromS3('data.txt', fileStream);
   *
   * @example
   * // Pipe to HTTP response (Express)
   * app.get('/download', async (req, res) => {
   *   res.setHeader('Content-Type', 'application/octet-stream');
   *   await s3Service.pipeFromS3('file.bin', res);
   * });
   */
  async pipeFromS3(
    s3FileKey: string,
    destination: Writable,
    options?: { Bucket?: string }
  ): Promise<void> {
    const result = await this.getFile({
      Key: s3FileKey,
      Bucket: options?.Bucket,
    });

    if (!(result.Body instanceof Readable)) {
      throw new Error(
        `File not readable -> key:${s3FileKey}, type:${Object.getPrototypeOf(
          result.Body
        )}`
      );
    }

    await pipeline(result.Body, destination);
  }

  /**
   * Gets the raw readable stream from an S3 file.
   * Caller is responsible for closing the stream.
   *
   * @example
   * const stream = await s3Service.getReadableStreamFromS3('data.bin');
   * stream.pipe(someTransform).pipe(destination);
   */
  async getReadableStreamFromS3(s3FileKey: string, options?: { Bucket?: string }): Promise<Readable> {
    const result = await this.getFile({
      Key: s3FileKey,
      Bucket: options?.Bucket,
    });

    if (!(result.Body instanceof Readable)) {
      throw new Error(
        `File not readable -> key:${s3FileKey}, type:${Object.getPrototypeOf(
          result.Body
        )}`
      );
    }

    return result.Body;
  }

  async uploadPublic(params: TS3Params & { Body: PutObjectRequest['Body'], ContentType?: PutObjectRequest['ContentType'] }): Promise<IS3UploadResponse> {
    return await this.upload({ ...params, ACL: 'public-read' });
  }

  async getPresignedUrl(params: TS3Params & { Expires: number, ResponseContentDisposition: string }): Promise<string> {
    const { Bucket, Key } = this.addDefaultBucket(params);
    const command = new GetObjectCommand({ Bucket, Key });
    const url = await getSignedUrl(this.s3, command, { expiresIn: params.Expires });

    return url;
  }

  async getFile(params: TS3Params) {
    if (!params?.Key) {
      throw new BadRequestException(`${S3Service.name}.${S3Service.prototype.getFile.name} requires a valid S3 key`)
    }

    const { Bucket, Key } = this.addDefaultBucket(params);
    const command = new GetObjectCommand({ Bucket, Key });
    return await this.s3.send(command);
  }

  async delete(params: TS3Params) {
    if (!params?.Key) {
      throw new BadRequestException(`${S3Service.name}.${S3Service.prototype.delete.name} requires a valid S3 key`)
    }

    const command = new DeleteObjectCommand(this.addDefaultBucket(params));
    const data = await this.s3.send(command);

    return data;
  }

  async deleteByPrefix(params: TS3PrefixParams) {
    if (!params?.Prefix) {
      throw new BadRequestException(`${S3Service.name}.${S3Service.prototype.deleteByPrefix.name} requires a valid S3 prefix`)
    }

    const command = new ListObjectsV2Command(this.addDefaultBucket(params));
    const data = await this.s3.send(command);

    const Objects: {Key: string}[] = (data.Contents || []).map(({ Key }) => ({ Key })) as any;

    await this.deleteObjects(this.addDefaultBucket({ ...params, Objects }));
  }

  async deleteObjects(params: TS3ObjectsParams) {
    if (!params?.Objects?.length) {
      throw new BadRequestException(`${S3Service.name}.${S3Service.prototype.deleteByPrefix.name} requires an array of valid S3 keys`)
    }

    const { Objects, Bucket } = this.addDefaultBucket(params);

    if (Objects.length) {

      const command = new DeleteObjectsCommand({
        Bucket,
        Delete: { Objects }
      });

      return await this.s3.send(command);
    }
  }

  async getDownloadUrl(params: TS3Params & { fileName?: string | null | undefined }) {
    if (!params || !params?.Key) {
      throw new BadRequestException(`${S3Service.name}.${S3Service.prototype.getDownloadUrl.name} requires a valid S3 key`)
    }

    return await this.getPresignedUrl({
      ...this.addDefaultBucket(params),
      Expires: 100,
      ResponseContentDisposition: `attachment; filename="${params.fileName || params.Key.split('/').pop()}"`
    });
  }

  async getAssetUrl(params: TS3Params & { Expires?: number | null | undefined }) {
    if (!params || !params?.Key) {
      throw new BadRequestException(`${S3Service.name}.${S3Service.prototype.getAssetUrl.name} requires a valid S3 key`)
    }

    return await this.getPresignedUrl({
      ...this.addDefaultBucket(params),
      Expires: params.Expires || 10_000,
      ResponseContentDisposition: 'inline'
    })
  }

  private addDefaultBucket<TParams extends { Bucket?: string | null } & Record<string, any>>(params: TParams): TParams & { Bucket: string } {
    return { ...params, Bucket: this.getBucket(params?.Bucket) } as TParams & { Bucket: string };
  }

  private getBucket(Bucket?: string | null): string {
    return Bucket || this.config.AWS_BUCKET;
  }
}

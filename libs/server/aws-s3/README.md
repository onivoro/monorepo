# @onivoro/server-aws-s3

AWS S3 integration for NestJS applications: uploads, downloads, line-by-line streaming, deletes, and pre-signed URLs.

## Installation

```bash
npm install @onivoro/server-aws-s3 @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

`@nestjs/common` is also a peer dependency.

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsS3Module } from '@onivoro/server-aws-s3';

@Module({
  imports: [
    ServerAwsS3Module.configure({
      AWS_REGION: process.env.AWS_REGION!,
      AWS_BUCKET: process.env.AWS_BUCKET!,
      AWS_PROFILE: process.env.AWS_PROFILE, // optional
    }),
  ],
})
export class AppModule {}
```

## Configuration

```typescript
export class ServerAwsS3Config {
  AWS_BUCKET: string; // default bucket when a call omits Bucket
  AWS_PROFILE?: string;
  AWS_REGION: string;
}
```

Credentials come from [`@onivoro/server-aws-credential-providers`](../aws-credential-providers/): when `AWS_PROFILE` is set the named profile is used, otherwise the AWS SDK default credential chain applies.

The module provides and exports `S3Service`, an `S3Client`, and `ServerAwsS3Config`.

## S3Service

All methods take an object parameter. `Bucket` is optional everywhere and falls back to `AWS_BUCKET`.

```typescript
import { Injectable } from '@nestjs/common';
import { S3Service, sanitizeFilename } from '@onivoro/server-aws-s3';

@Injectable()
export class DocumentService {
  constructor(private readonly s3: S3Service) {}

  async uploadDocument(userId: string, file: Express.Multer.File) {
    const Key = `documents/${userId}/${Date.now()}-${sanitizeFilename(file.originalname)}`;
    const { Location, ETag } = await this.s3.upload({
      Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });
    return { Key, Location, ETag };
  }

  getViewUrl(Key: string) {
    return this.s3.getAssetUrl({ Key, Expires: 3600 });
  }

  deleteUserDocuments(userId: string) {
    return this.s3.deleteByPrefix({ Prefix: `documents/${userId}/` });
  }
}
```

### Upload

- **`upload({ Key, Body, Bucket?, ACL?, ContentType? })`**: sends `PutObjectCommand` and resolves to an `IS3UploadResponse` (`{ Location, Bucket, Key, ETag? }`). `Location` is built by `resolveUrl` (virtual-hosted style, or path style when the bucket name contains a dot). At runtime the returned object also carries the other params you passed (`Body`, `ACL`, `ContentType`).
- **`uploadPublic({ Key, Body, Bucket?, ContentType? })`**: `upload` with `ACL: 'public-read'`. The bucket must allow ACLs.

### Download and Streaming

- **`getFile({ Key, Bucket? })`**: returns the raw `GetObjectCommandOutput`. Throws `BadRequestException` if `Key` is empty.
- **`getReadableStreamFromS3(key, { Bucket? }?)`**: returns the object body as a Node `Readable`; the caller closes it.
- **`pipeFromS3(key, destination, { Bucket? }?)`**: pipes the object body into a `Writable` using `stream/promises` `pipeline`.
- **`streamFromS3<T>(key, options?)`**: async generator yielding one record per line. Lines are parsed with `JSON.parse` unless you pass `parser`. Options (`TStreamFromS3Options<T>`): `Bucket`, `skipEmptyLines` (default `true`), `parser`, plus any `readline` options except `input` (such as `signal`); `crlfDelay` defaults to `Infinity`.
- **`streamLinesFromS3(key, options?)`**: yields raw string lines.
- **`streamCsvFromS3(key, options?)`**: yields `string[]` rows by splitting on `delimiter` (default `,`); `skipHeader: true` drops the first row. Empty lines are always skipped. It does not handle quoted fields.
- **`collectFromS3<T>(key, options?)`**: collects `streamFromS3` records into an array, stopping at `limit` if given.
- **`forEachFromS3<T>(key, callback, options?)`**: awaits `callback(record, index)` for each record and resolves to the record count.

The streaming helpers (and `pipeFromS3` / `getReadableStreamFromS3`) throw `File not readable -> key:<key>, type:<type>` if the object body is not a Node `Readable`, where `<type>` is the body's constructor name (such as `Uint8Array`) or its `typeof` (such as `undefined`).

```typescript
// JSON Lines
for await (const event of this.s3.streamFromS3<AuditEvent>('exports/audit.jsonl')) {
  await this.handle(event);
}

// CSV with header
for await (const [name, email] of this.s3.streamCsvFromS3('imports/users.csv', { skipHeader: true })) {
  // ...
}

// First 100 records
const sample = await this.s3.collectFromS3<AuditEvent>('exports/audit.jsonl', { limit: 100 });

// Stream an object to an HTTP response
await this.s3.pipeFromS3('reports/q3.pdf', res);
```

### Pre-signed URLs

- **`getPresignedUrl({ Key, Bucket?, Expires, ResponseContentDisposition })`**: signs a `GetObjectCommand` that expires in `Expires` seconds, with `ResponseContentDisposition` set so S3 returns that `Content-Disposition` header.
- **`getDownloadUrl({ Key, Bucket?, fileName? })`**: `getPresignedUrl` with a 100-second expiry and an `attachment; filename="..."` disposition, so browsers download the file under that name.
- **`getAssetUrl({ Key, Bucket?, Expires? })`**: `getPresignedUrl` with an `inline` disposition and a default expiry of 10,000 seconds.

### Delete

- **`delete({ Key, Bucket? })`**: sends `DeleteObjectCommand`.
- **`deleteObjects({ Objects, Bucket? })`**: sends `DeleteObjectsCommand` for `Objects: { Key }[]`. Throws `BadRequestException` if `Objects` is empty.
- **`deleteByPrefix({ Prefix, Bucket? })`**: lists every object under the prefix with `ListObjectsV2Command`, following `NextContinuationToken`, and deletes each page (up to 1,000 keys) with `deleteObjects`. Resolves to `undefined`, and does nothing when no object matches. Throws `BadRequestException` if `Prefix` is empty. Per-key failures that S3 reports in a `DeleteObjects` response's `Errors` are not checked.

## Direct Client Access

Inject the `S3Client` the module provides for anything the service does not cover:

```typescript
import { Injectable } from '@nestjs/common';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class MetadataService {
  constructor(private readonly s3Client: S3Client) {}

  head(Bucket: string, Key: string) {
    return this.s3Client.send(new HeadObjectCommand({ Bucket, Key }));
  }
}
```

## Utility Functions

```typescript
import { extractS3KeyFromUrl, extractS3NameFromKey, extractS3NameFromUrl, resolveUrl, sanitizeFilename } from '@onivoro/server-aws-s3';

resolveUrl('us-east-2', { Bucket: 'my-bucket', Key: 'a/b.pdf' });
// 'https://my-bucket.s3.us-east-2.amazonaws.com/a/b.pdf'
resolveUrl('us-east-2', { Bucket: 'my.bucket', Key: 'a/b.pdf' });
// 'https://s3.us-east-2.amazonaws.com/my.bucket/a/b.pdf'

extractS3KeyFromUrl('https://my-bucket.s3.us-east-2.amazonaws.com/a/b.pdf'); // 'a/b.pdf'
extractS3KeyFromUrl('https://s3.us-east-2.amazonaws.com/my.bucket/a/b.pdf?X-Amz-Expires=60'); // 'a/b.pdf'
extractS3NameFromKey('a/b.pdf'); // 'b.pdf'
extractS3NameFromUrl('https://my-bucket.s3.us-east-2.amazonaws.com/a/b.pdf'); // 'b.pdf'

sanitizeFilename('Q3 report: "final"!.pdf'); // 'Q3 report_ _final_.pdf'
```

- `extractS3KeyFromUrl` returns the path after the host, dropping any `?query` or `#fragment`. For path-style hosts (`s3.amazonaws.com`, `s3.<region>.amazonaws.com`, `s3-<region>.amazonaws.com`, `s3.dualstack.<region>.amazonaws.com`) it also drops the leading bucket segment, so it round-trips with `resolveUrl` in both styles. For `s3://bucket/key` it returns `key`. The key is not URL-decoded, matching `resolveUrl`, which does not encode it; keys containing `?` or `#` therefore do not round-trip. Input without `//` is returned unchanged. `extractS3NameFromUrl` uses it, so it gets the same handling.
- `sanitizeFilename` replaces non-ASCII characters and ``/ ? : \ { } ^ ' % ` [ ] < > ~ # | " ! *`` with `_`, collapses repeated underscores, and trims whitespace. Spaces are kept.

## Exported Types

- `TS3Params`: `{ Key: string; Bucket?: string | null }`
- `TS3PrefixParams`: `{ Prefix: string; Bucket?: string | null }`
- `TS3ObjectsParams`: `{ Objects: { Key: string }[]; Bucket?: string | null }`
- `TStreamFromS3Options<T>`
- `IS3UploadResponse`

## License

MIT

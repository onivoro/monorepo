import { BadRequestException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  PutObjectRequest,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable, Writable } from 'node:stream';
import { S3Service } from './s3.service';
import { ServerAwsS3Config } from '../server-aws-s3-config.class';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<
  typeof getSignedUrl
>;

describe(S3Service.name, () => {
  const config: ServerAwsS3Config = {
    AWS_BUCKET: 'default-bucket',
    AWS_REGION: 'us-east-2',
  };
  let send: jest.Mock;
  let s3: S3Client;
  let service: S3Service;

  const body = (...chunks: string[]) => Readable.from(chunks);
  const respondWith = (Body: unknown) => send.mockResolvedValue({ Body });
  const drain = async <T>(iterable: AsyncIterable<T>) => {
    const out: T[] = [];
    for await (const item of iterable) out.push(item);
    return out;
  };

  beforeEach(() => {
    send = jest.fn();
    s3 = { send } as unknown as S3Client;
    service = new S3Service(config, s3);
    mockGetSignedUrl.mockReset();
  });

  describe('upload', () => {
    const payload = 'data' as unknown as PutObjectRequest['Body'];

    it('puts the object in the default bucket and returns its location', async () => {
      send.mockResolvedValue({ ETag: '"abc"' });

      const result = await service.upload({
        Key: 'docs/a.pdf',
        Body: payload,
        ContentType: 'application/pdf',
      });

      const [command] = send.mock.calls[0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toEqual({
        Key: 'docs/a.pdf',
        Bucket: 'default-bucket',
        Body: payload,
        ContentType: 'application/pdf',
      });
      expect(result).toMatchObject({
        Location:
          'https://default-bucket.s3.us-east-2.amazonaws.com/docs/a.pdf',
        Bucket: 'default-bucket',
        Key: 'docs/a.pdf',
        ETag: '"abc"',
      });
    });

    it('uses an explicit bucket, including path-style URLs for dotted buckets', async () => {
      send.mockResolvedValue({});

      const result = await service.upload({
        Key: 'a.txt',
        Bucket: 'my.dotted.bucket',
        Body: payload,
      });

      expect(send.mock.calls[0][0].input.Bucket).toBe('my.dotted.bucket');
      expect(result.Location).toBe(
        'https://s3.us-east-2.amazonaws.com/my.dotted.bucket/a.txt',
      );
      expect(result.ETag).toBeUndefined();
    });

    it('falls back to the default bucket when Bucket is null', async () => {
      send.mockResolvedValue({});

      await service.upload({ Key: 'a.txt', Bucket: null, Body: payload });

      expect(send.mock.calls[0][0].input.Bucket).toBe('default-bucket');
    });

    it('propagates client errors', async () => {
      const error = new Error('AccessDenied');
      send.mockRejectedValue(error);

      await expect(service.upload({ Key: 'a', Body: payload })).rejects.toBe(
        error,
      );
    });
  });

  describe('uploadPublic', () => {
    const payload = 'data' as unknown as PutObjectRequest['Body'];

    it('uploads with a public-read ACL', async () => {
      send.mockResolvedValue({ ETag: 'e' });

      const result = await service.uploadPublic({
        Key: 'img.png',
        Body: payload,
      });

      expect(send.mock.calls[0][0].input).toMatchObject({
        Key: 'img.png',
        Bucket: 'default-bucket',
        ACL: 'public-read',
      });
      expect(result.Location).toBe(
        'https://default-bucket.s3.us-east-2.amazonaws.com/img.png',
      );
    });
  });

  describe('getFile', () => {
    it('gets the object from the default bucket', async () => {
      const response = { Body: 'x' };
      send.mockResolvedValue(response);

      await expect(service.getFile({ Key: 'k' })).resolves.toBe(response);
      const [command] = send.mock.calls[0];
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toEqual({ Bucket: 'default-bucket', Key: 'k' });
    });

    it('uses an explicit bucket', async () => {
      send.mockResolvedValue({});

      await service.getFile({ Key: 'k', Bucket: 'other' });

      expect(send.mock.calls[0][0].input).toEqual({
        Bucket: 'other',
        Key: 'k',
      });
    });

    it.each([[{ Key: '' }], [undefined]])(
      'rejects a missing key (%j)',
      async (params) => {
        await expect(service.getFile(params as any)).rejects.toThrow(
          new BadRequestException('S3Service.getFile requires a valid S3 key'),
        );
        expect(send).not.toHaveBeenCalled();
      },
    );
  });

  describe('delete', () => {
    it('deletes the object', async () => {
      const response = { DeleteMarker: true };
      send.mockResolvedValue(response);

      await expect(service.delete({ Key: 'k' })).resolves.toBe(response);
      const [command] = send.mock.calls[0];
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toEqual({ Key: 'k', Bucket: 'default-bucket' });
    });

    it.each([[{ Key: '' }], [undefined]])(
      'rejects a missing key (%j)',
      async (params) => {
        await expect(service.delete(params as any)).rejects.toThrow(
          new BadRequestException('S3Service.delete requires a valid S3 key'),
        );
        expect(send).not.toHaveBeenCalled();
      },
    );
  });

  describe('deleteObjects', () => {
    it('deletes the given keys in one request', async () => {
      const response = { Deleted: [] };
      send.mockResolvedValue(response);

      await expect(
        service.deleteObjects({
          Bucket: 'other',
          Objects: [{ Key: 'a' }, { Key: 'b' }],
        }),
      ).resolves.toBe(response);
      const [command] = send.mock.calls[0];
      expect(command).toBeInstanceOf(DeleteObjectsCommand);
      expect(command.input).toEqual({
        Bucket: 'other',
        Delete: { Objects: [{ Key: 'a' }, { Key: 'b' }] },
      });
    });

    it('uses the default bucket', async () => {
      send.mockResolvedValue({});

      await service.deleteObjects({ Objects: [{ Key: 'a' }] });

      expect(send.mock.calls[0][0].input.Bucket).toBe('default-bucket');
    });

    it.each([[{ Objects: [] }], [{}], [undefined]])(
      'rejects when there are no objects (%j)',
      async (params) => {
        await expect(service.deleteObjects(params as any)).rejects.toThrow(
          new BadRequestException(
            'S3Service.deleteObjects requires an array of valid S3 keys',
          ),
        );
        expect(send).not.toHaveBeenCalled();
      },
    );
  });

  describe('deleteByPrefix', () => {
    it('lists objects under the prefix and deletes them', async () => {
      send
        .mockResolvedValueOnce({ Contents: [{ Key: 'p/a' }, { Key: 'p/b' }] })
        .mockResolvedValueOnce({});

      await service.deleteByPrefix({ Prefix: 'p/' });

      const [list, del] = send.mock.calls.map(([c]) => c);
      expect(list).toBeInstanceOf(ListObjectsV2Command);
      expect(list.input).toEqual({ Prefix: 'p/', Bucket: 'default-bucket' });
      expect(del).toBeInstanceOf(DeleteObjectsCommand);
      expect(del.input).toEqual({
        Bucket: 'default-bucket',
        Delete: { Objects: [{ Key: 'p/a' }, { Key: 'p/b' }] },
      });
    });

    it.each([[{ Prefix: '' }], [undefined]])(
      'rejects a missing prefix (%j)',
      async (params) => {
        await expect(service.deleteByPrefix(params as any)).rejects.toThrow(
          new BadRequestException(
            'S3Service.deleteByPrefix requires a valid S3 prefix',
          ),
        );
        expect(send).not.toHaveBeenCalled();
      },
    );

    it('resolves without deleting when nothing matches', async () => {
      send.mockResolvedValueOnce({ Contents: [] });

      await expect(
        service.deleteByPrefix({ Prefix: 'p/' }),
      ).resolves.toBeUndefined();
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('follows ContinuationToken to delete every matching object', async () => {
      send
        .mockResolvedValueOnce({
          Contents: [{ Key: 'p/a' }],
          IsTruncated: true,
          NextContinuationToken: 't',
        })
        .mockResolvedValue({ Contents: [{ Key: 'p/b' }] });

      await service.deleteByPrefix({ Prefix: 'p/' });

      const lists = send.mock.calls
        .map(([c]) => c)
        .filter((c) => c instanceof ListObjectsV2Command);
      expect(lists.map((c) => c.input)).toEqual([
        { Bucket: 'default-bucket', Prefix: 'p/' },
        { Bucket: 'default-bucket', Prefix: 'p/', ContinuationToken: 't' },
      ]);
      const deletes = send.mock.calls
        .map(([c]) => c)
        .filter((c) => c instanceof DeleteObjectsCommand);
      expect(deletes.map((c) => c.input.Delete?.Objects)).toEqual([
        [{ Key: 'p/a' }],
        [{ Key: 'p/b' }],
      ]);
    });
  });

  describe('presigned URLs', () => {
    beforeEach(() => mockGetSignedUrl.mockResolvedValue('https://signed'));

    const signedCommand = () => {
      const [client, command, options] = mockGetSignedUrl.mock.calls[0];
      return { client, command: command as GetObjectCommand, options };
    };

    it('getPresignedUrl signs a GetObject request with the given expiry', async () => {
      await expect(
        service.getPresignedUrl({
          Key: 'k',
          Expires: 60,
          ResponseContentDisposition: 'inline',
        }),
      ).resolves.toBe('https://signed');

      const { client, command, options } = signedCommand();
      expect(client).toBe(s3);
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: 'default-bucket',
        Key: 'k',
      });
      expect(options).toEqual({ expiresIn: 60 });
    });

    it('getPresignedUrl signs the requested ResponseContentDisposition', async () => {
      await service.getPresignedUrl({
        Key: 'k',
        Expires: 60,
        ResponseContentDisposition: 'attachment; filename="k"',
      });

      expect(signedCommand().command.input.ResponseContentDisposition).toBe(
        'attachment; filename="k"',
      );
    });

    it('getDownloadUrl signs with a 100 second expiry', async () => {
      await expect(
        service.getDownloadUrl({ Key: 'dir/report.csv', Bucket: 'other' }),
      ).resolves.toBe('https://signed');

      const { command, options } = signedCommand();
      expect(command.input).toMatchObject({
        Bucket: 'other',
        Key: 'dir/report.csv',
        ResponseContentDisposition: 'attachment; filename="report.csv"',
      });
      expect(options).toEqual({ expiresIn: 100 });
    });

    it.each([[{ Key: '' }], [undefined]])(
      'getDownloadUrl rejects a missing key (%j)',
      async (params) => {
        await expect(service.getDownloadUrl(params as any)).rejects.toThrow(
          new BadRequestException(
            'S3Service.getDownloadUrl requires a valid S3 key',
          ),
        );
        expect(mockGetSignedUrl).not.toHaveBeenCalled();
      },
    );

    it('getAssetUrl defaults the expiry to 10000 seconds', async () => {
      await expect(service.getAssetUrl({ Key: 'img.png' })).resolves.toBe(
        'https://signed',
      );

      const { command, options } = signedCommand();
      expect(command.input).toMatchObject({
        Bucket: 'default-bucket',
        Key: 'img.png',
        ResponseContentDisposition: 'inline',
      });
      expect(options).toEqual({ expiresIn: 10_000 });
    });

    it('getAssetUrl honours an explicit expiry', async () => {
      await service.getAssetUrl({ Key: 'img.png', Expires: 30 });

      expect(signedCommand().options).toEqual({ expiresIn: 30 });
    });

    it.each([[{ Key: '' }], [undefined]])(
      'getAssetUrl rejects a missing key (%j)',
      async (params) => {
        await expect(service.getAssetUrl(params as any)).rejects.toThrow(
          new BadRequestException(
            'S3Service.getAssetUrl requires a valid S3 key',
          ),
        );
      },
    );
  });

  describe('streamFromS3', () => {
    it('parses JSON lines and skips blank lines by default', async () => {
      respondWith(body('{"id":1}\n', '\n   \n{"id"', ':2}\r\n{"id":3}'));

      await expect(drain(service.streamFromS3('data.jsonl'))).resolves.toEqual([
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ]);
      expect(send.mock.calls[0][0].input).toEqual({
        Bucket: 'default-bucket',
        Key: 'data.jsonl',
      });
    });

    it('reads from an explicit bucket', async () => {
      respondWith(body('{}'));

      await drain(service.streamFromS3('k', { Bucket: 'other' }));

      expect(send.mock.calls[0][0].input).toEqual({
        Bucket: 'other',
        Key: 'k',
      });
    });

    it('uses a custom parser and keeps blank lines when asked', async () => {
      respondWith(body('a\n\nb\n'));

      await expect(
        drain(
          service.streamFromS3('k', {
            parser: (line) => `<${line}>`,
            skipEmptyLines: false,
          }),
        ),
      ).resolves.toEqual(['<a>', '<>', '<b>']);
    });

    it('destroys the body when the consumer stops early', async () => {
      const stream = body('{"n":1}\n{"n":2}\n{"n":3}\n');
      respondWith(stream);

      for await (const _ of service.streamFromS3('k')) break;

      expect(stream.destroyed).toBe(true);
    });

    it('destroys the body and rethrows when a line fails to parse', async () => {
      const stream = body('{"ok":true}\nnot json\n');
      respondWith(stream);

      await expect(drain(service.streamFromS3('k'))).rejects.toThrow(
        SyntaxError,
      );
      expect(stream.destroyed).toBe(true);
    });

    it.each([
      ['a string', 'text'],
      ['a plain object', {}],
    ])('throws when the body is %s', async (_, value) => {
      respondWith(value);

      await expect(drain(service.streamFromS3('k'))).rejects.toThrow(
        /^File not readable -> key:k, type:/,
      );
    });

    it.each([
      ['a Uint8Array', new Uint8Array([1]), 'Uint8Array'],
      ['missing', undefined, 'undefined'],
      ['null', null, 'object'],
      ['a null-prototype object', Object.create(null), 'object'],
    ])(
      'throws the not-readable error when the body is %s',
      async (_, value, type) => {
        respondWith(value);

        await expect(drain(service.streamFromS3('k'))).rejects.toThrow(
          `File not readable -> key:k, type:${type}`,
        );
      },
    );
  });

  describe('streamLinesFromS3', () => {
    it('yields raw lines, skipping blank ones', async () => {
      respondWith(body('{"not":"parsed"}\n\nplain text\n'));

      await expect(
        drain(service.streamLinesFromS3('log.txt')),
      ).resolves.toEqual(['{"not":"parsed"}', 'plain text']);
    });

    it('can keep blank lines', async () => {
      respondWith(body('a\n\nb'));

      await expect(
        drain(service.streamLinesFromS3('k', { skipEmptyLines: false })),
      ).resolves.toEqual(['a', '', 'b']);
    });
  });

  describe('streamCsvFromS3', () => {
    const csv = 'name,age\nann,30\n\nbob,40\n';

    it('splits rows on commas, keeping the header by default', async () => {
      respondWith(body(csv));

      await expect(drain(service.streamCsvFromS3('u.csv'))).resolves.toEqual([
        ['name', 'age'],
        ['ann', '30'],
        ['bob', '40'],
      ]);
    });

    it('skips the header row when asked', async () => {
      respondWith(body(csv));

      await expect(
        drain(service.streamCsvFromS3('u.csv', { skipHeader: true })),
      ).resolves.toEqual([
        ['ann', '30'],
        ['bob', '40'],
      ]);
    });

    it('supports a custom delimiter and bucket', async () => {
      respondWith(body('a\tb\nc\td'));

      await expect(
        drain(
          service.streamCsvFromS3('t.tsv', {
            delimiter: '\t',
            Bucket: 'other',
          }),
        ),
      ).resolves.toEqual([
        ['a', 'b'],
        ['c', 'd'],
      ]);
      expect(send.mock.calls[0][0].input.Bucket).toBe('other');
    });
  });

  describe('collectFromS3', () => {
    it('collects every record', async () => {
      respondWith(body('1\n2\n3\n'));

      await expect(service.collectFromS3<number>('k')).resolves.toEqual([
        1, 2, 3,
      ]);
    });

    it('stops reading at the limit', async () => {
      const stream = body('1\n2\n3\n');
      respondWith(stream);

      await expect(
        service.collectFromS3<number>('k', { limit: 2 }),
      ).resolves.toEqual([1, 2]);
      expect(stream.destroyed).toBe(true);
    });

    it('passes stream options through', async () => {
      respondWith(body('a\nb\n'));

      await expect(
        service.collectFromS3('k', { parser: (l) => l.toUpperCase() }),
      ).resolves.toEqual(['A', 'B']);
    });
  });

  describe('forEachFromS3', () => {
    it('awaits the callback for each record in order and returns the count', async () => {
      respondWith(body('{"n":1}\n{"n":2}\n'));
      const seen: unknown[] = [];

      const count = await service.forEachFromS3<{ n: number }>(
        'k',
        async (record, index) => {
          await Promise.resolve();
          seen.push([record.n, index]);
        },
      );

      expect(count).toBe(2);
      expect(seen).toEqual([
        [1, 0],
        [2, 1],
      ]);
    });

    it('returns 0 for an empty file', async () => {
      respondWith(body(''));
      const callback = jest.fn();

      await expect(service.forEachFromS3('k', callback)).resolves.toBe(0);
      expect(callback).not.toHaveBeenCalled();
    });

    it('stops and rethrows when the callback throws', async () => {
      const stream = body('1\n2\n3\n');
      respondWith(stream);
      const error = new Error('db down');
      const callback = jest.fn().mockRejectedValueOnce(error);

      await expect(service.forEachFromS3('k', callback)).rejects.toBe(error);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(stream.destroyed).toBe(true);
    });
  });

  describe('pipeFromS3', () => {
    const sink = () => {
      const chunks: string[] = [];
      const writable = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(chunk.toString());
          callback();
        },
      });
      return { chunks, writable };
    };

    it('pipes the object body into the destination', async () => {
      respondWith(body('hello ', 'world'));
      const { chunks, writable } = sink();

      await service.pipeFromS3('k', writable, { Bucket: 'other' });

      expect(chunks.join('')).toBe('hello world');
      expect(writable.writableFinished).toBe(true);
      expect(send.mock.calls[0][0].input).toEqual({
        Bucket: 'other',
        Key: 'k',
      });
    });

    it('rejects when the destination errors', async () => {
      respondWith(body('x'));
      const writable = new Writable({
        write(_chunk, _encoding, callback) {
          callback(new Error('disk full'));
        },
      });

      await expect(service.pipeFromS3('k', writable)).rejects.toThrow(
        'disk full',
      );
    });

    it('throws when the body is not readable', async () => {
      respondWith('text');

      await expect(service.pipeFromS3('k', sink().writable)).rejects.toThrow(
        /^File not readable -> key:k/,
      );
    });

    it.each([
      [new Uint8Array([1]), 'Uint8Array'],
      [undefined, 'undefined'],
    ])('throws the not-readable error for a %p body', async (value, type) => {
      respondWith(value);

      await expect(service.pipeFromS3('k', sink().writable)).rejects.toThrow(
        `File not readable -> key:k, type:${type}`,
      );
    });
  });

  describe('getReadableStreamFromS3', () => {
    it('returns the body stream', async () => {
      const stream = body('x');
      respondWith(stream);

      await expect(service.getReadableStreamFromS3('k')).resolves.toBe(stream);
      expect(send.mock.calls[0][0].input.Bucket).toBe('default-bucket');
    });

    it('uses an explicit bucket', async () => {
      respondWith(body('x'));

      await service.getReadableStreamFromS3('k', { Bucket: 'other' });

      expect(send.mock.calls[0][0].input.Bucket).toBe('other');
    });

    it('throws when the body is not readable', async () => {
      respondWith({});

      await expect(service.getReadableStreamFromS3('k')).rejects.toThrow(
        /^File not readable -> key:k/,
      );
    });

    it.each([
      [new Uint8Array([1]), 'Uint8Array'],
      [undefined, 'undefined'],
    ])('throws the not-readable error for a %p body', async (value, type) => {
      respondWith(value);

      await expect(service.getReadableStreamFromS3('k')).rejects.toThrow(
        `File not readable -> key:k, type:${type}`,
      );
    });
  });
});

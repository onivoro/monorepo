# @onivoro/server-aws-s3

A NestJS module for integrating with AWS S3 (Simple Storage Service), providing file upload, download, management, and bucket operations for your server applications.

## Installation

```bash
npm install @onivoro/server-aws-s3
```

## Features

- **S3 Client Integration**: Direct integration with AWS S3 service
- **Bucket Operations**: Create, list, and manage S3 buckets
- **File Upload/Download**: Upload and download files to/from S3
- **Pre-signed URLs**: Generate secure, time-limited URLs for file access
- **Multipart Uploads**: Support for large file uploads
- **Object Management**: List, copy, move, and delete S3 objects
- **Environment-Based Configuration**: Configurable S3 settings per environment
- **Credential Provider Integration**: Seamless integration with AWS credential providers

## Quick Start

### 1. Module Configuration

```typescript
import { ServerAwsS3Module } from '@onivoro/server-aws-s3';

@Module({
  imports: [
    ServerAwsS3Module.configure({
      AWS_REGION: 'us-east-1',
      AWS_BUCKET: process.env.S3_BUCKET_NAME,
      AWS_PROFILE: process.env.AWS_PROFILE || 'default',
    }),
  ],
})
export class AppModule {}
```

### 2. Basic Usage

```typescript
import { S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class FileService {
  constructor(private s3Client: S3Client) {}

  async uploadFile(file: Buffer, key: string, bucket?: string) {
    const uploadParams = {
      Bucket: bucket || process.env.S3_BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: 'application/octet-stream'
    };

    return this.s3Client.send(new PutObjectCommand(uploadParams));
  }

  async downloadFile(key: string, bucket?: string) {
    const downloadParams = {
      Bucket: bucket || process.env.S3_BUCKET_NAME,
      Key: key
    };

    return this.s3Client.send(new GetObjectCommand(downloadParams));
  }

  async deleteFile(key: string, bucket?: string) {
    const deleteParams = {
      Bucket: bucket || process.env.S3_BUCKET_NAME,
      Key: key
    };

    return this.s3Client.send(new DeleteObjectCommand(deleteParams));
  }
}
```

## Configuration

### ServerAwsS3Config

```typescript
import { ServerAwsS3Config } from '@onivoro/server-aws-s3';

export class AppS3Config extends ServerAwsS3Config {
  AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  AWS_BUCKET = process.env.S3_BUCKET_NAME || 'my-default-bucket';
  AWS_PROFILE = process.env.AWS_PROFILE || 'default';
}
```

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# S3 Configuration
S3_BUCKET_NAME=my-application-bucket
```

## Usage Examples

### File Upload Service

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class S3FileUploadService {
  constructor(private s3Client: S3Client) {}

  async uploadImage(imageBuffer: Buffer, fileName: string, metadata?: Record<string, string>) {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `images/${fileName}`,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
      Metadata: metadata || {},
      ServerSideEncryption: 'AES256'
    };

    return this.s3Client.send(new PutObjectCommand(params));
  }

  async uploadDocument(documentBuffer: Buffer, fileName: string, mimeType: string) {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `documents/${fileName}`,
      Body: documentBuffer,
      ContentType: mimeType,
      StorageClass: 'STANDARD_IA' // Infrequent Access for cost savings
    };

    return this.s3Client.send(new PutObjectCommand(params));
  }

  async uploadWithTags(fileBuffer: Buffer, key: string, tags: Record<string, string>) {
    const putParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: fileBuffer
    };

    await this.s3Client.send(new PutObjectCommand(putParams));

    // Add tags after upload
    const tagParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Tagging: {
        TagSet: Object.entries(tags).map(([Key, Value]) => ({ Key, Value }))
      }
    };

    return this.s3Client.send(new PutObjectTaggingCommand(tagParams));
  }
}
```

### Pre-signed URL Service

```typescript
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3PresignedUrlService {
  constructor(private s3Client: S3Client) {}

  async generateDownloadUrl(key: string, expiresIn: number = 3600) {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async generateUploadUrl(key: string, contentType: string, expiresIn: number = 3600) {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ContentType: contentType
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async generateMultipleDownloadUrls(keys: string[], expiresIn: number = 3600) {
    const urlPromises = keys.map(key => this.generateDownloadUrl(key, expiresIn));
    const urls = await Promise.all(urlPromises);
    
    return keys.reduce((result, key, index) => {
      result[key] = urls[index];
      return result;
    }, {} as Record<string, string>);
  }
}
```

### Bucket Management Service

```typescript
import { 
  S3Client, 
  CreateBucketCommand, 
  ListBucketsCommand, 
  DeleteBucketCommand,
  HeadBucketCommand,
  PutBucketVersioningCommand
} from '@aws-sdk/client-s3';

@Injectable()
export class S3BucketService {
  constructor(private s3Client: S3Client) {}

  async createBucket(bucketName: string, region?: string) {
    const params = {
      Bucket: bucketName,
      CreateBucketConfiguration: region && region !== 'us-east-1' 
        ? { LocationConstraint: region }
        : undefined
    };

    return this.s3Client.send(new CreateBucketCommand(params));
  }

  async listBuckets() {
    return this.s3Client.send(new ListBucketsCommand({}));
  }

  async bucketExists(bucketName: string): Promise<boolean> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      return true;
    } catch (error) {
      return false;
    }
  }

  async enableVersioning(bucketName: string) {
    const params = {
      Bucket: bucketName,
      VersioningConfiguration: {
        Status: 'Enabled'
      }
    };

    return this.s3Client.send(new PutBucketVersioningCommand(params));
  }

  async deleteBucket(bucketName: string) {
    return this.s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));
  }
}
```

### Object Management Service

```typescript
import { 
  S3Client, 
  ListObjectsV2Command, 
  CopyObjectCommand, 
  DeleteObjectsCommand,
  GetObjectAttributesCommand
} from '@aws-sdk/client-s3';

@Injectable()
export class S3ObjectService {
  constructor(private s3Client: S3Client) {}

  async listObjects(bucket: string, prefix?: string, maxKeys: number = 1000) {
    const params = {
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: maxKeys
    };

    return this.s3Client.send(new ListObjectsV2Command(params));
  }

  async copyObject(sourceBucket: string, sourceKey: string, destBucket: string, destKey: string) {
    const params = {
      Bucket: destBucket,
      CopySource: `${sourceBucket}/${sourceKey}`,
      Key: destKey
    };

    return this.s3Client.send(new CopyObjectCommand(params));
  }

  async deleteMultipleObjects(bucket: string, keys: string[]) {
    const params = {
      Bucket: bucket,
      Delete: {
        Objects: keys.map(Key => ({ Key }))
      }
    };

    return this.s3Client.send(new DeleteObjectsCommand(params));
  }

  async getObjectMetadata(bucket: string, key: string) {
    const params = {
      Bucket: bucket,
      Key: key,
      ObjectAttributes: ['ETag', 'Checksum', 'ObjectSize', 'StorageClass']
    };

    return this.s3Client.send(new GetObjectAttributesCommand(params));
  }

  async moveObject(sourceBucket: string, sourceKey: string, destBucket: string, destKey: string) {
    // Copy the object
    await this.copyObject(sourceBucket, sourceKey, destBucket, destKey);
    
    // Delete the original
    const deleteParams = {
      Bucket: sourceBucket,
      Key: sourceKey
    };
    
    return this.s3Client.send(new DeleteObjectCommand(deleteParams));
  }
}
```

### Multipart Upload Service

```typescript
import { 
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} from '@aws-sdk/client-s3';

@Injectable()
export class S3MultipartUploadService {
  constructor(private s3Client: S3Client) {}

  async initiateMultipartUpload(bucket: string, key: string, contentType?: string) {
    const params = {
      Bucket: bucket,
      Key: key,
      ContentType: contentType
    };

    return this.s3Client.send(new CreateMultipartUploadCommand(params));
  }

  async uploadPart(
    bucket: string, 
    key: string, 
    uploadId: string, 
    partNumber: number, 
    body: Buffer
  ) {
    const params = {
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body
    };

    return this.s3Client.send(new UploadPartCommand(params));
  }

  async completeMultipartUpload(
    bucket: string, 
    key: string, 
    uploadId: string, 
    parts: Array<{ ETag: string; PartNumber: number }>
  ) {
    const params = {
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }
    };

    return this.s3Client.send(new CompleteMultipartUploadCommand(params));
  }

  async abortMultipartUpload(bucket: string, key: string, uploadId: string) {
    const params = {
      Bucket: bucket,
      Key: key,
      UploadId: uploadId
    };

    return this.s3Client.send(new AbortMultipartUploadCommand(params));
  }

  async uploadLargeFile(bucket: string, key: string, fileBuffer: Buffer, chunkSize: number = 5 * 1024 * 1024) {
    if (fileBuffer.length <= chunkSize) {
      // Use regular upload for small files
      return this.s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileBuffer
      }));
    }

    // Initiate multipart upload
    const { UploadId } = await this.initiateMultipartUpload(bucket, key);
    
    if (!UploadId) {
      throw new Error('Failed to initiate multipart upload');
    }

    const parts: Array<{ ETag: string; PartNumber: number }> = [];
    let partNumber = 1;
    let start = 0;

    try {
      while (start < fileBuffer.length) {
        const end = Math.min(start + chunkSize, fileBuffer.length);
        const chunk = fileBuffer.slice(start, end);

        const { ETag } = await this.uploadPart(bucket, key, UploadId, partNumber, chunk);
        
        if (ETag) {
          parts.push({ PartNumber: partNumber, ETag });
        }

        start = end;
        partNumber++;
      }

      return this.completeMultipartUpload(bucket, key, UploadId, parts);
    } catch (error) {
      // Abort the upload on error
      await this.abortMultipartUpload(bucket, key, UploadId);
      throw error;
    }
  }
}
```

## Advanced Usage

### File Processing Pipeline

```typescript
@Injectable()
export class S3FileProcessingService {
  constructor(private s3Client: S3Client) {}

  async processImagePipeline(imageBuffer: Buffer, fileName: string) {
    const originalKey = `original/${fileName}`;
    const processedKey = `processed/${fileName}`;
    
    // Upload original
    await this.s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: originalKey,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
      Metadata: { 'processing-status': 'uploaded' }
    }));

    // Process image (placeholder for actual image processing)
    const processedBuffer = await this.processImage(imageBuffer);

    // Upload processed version
    await this.s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: processedKey,
      Body: processedBuffer,
      ContentType: 'image/jpeg',
      Metadata: { 'processing-status': 'completed', 'original-key': originalKey }
    }));

    return { originalKey, processedKey };
  }

  private async processImage(buffer: Buffer): Promise<Buffer> {
    // Implement your image processing logic here
    return buffer;
  }
}
```

### S3 Event Processing

```typescript
@Injectable()
export class S3EventService {
  constructor(private s3Client: S3Client) {}

  async handleS3Event(event: any) {
    for (const record of event.Records) {
      if (record.eventSource === 'aws:s3') {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key);
        const eventName = record.eventName;

        switch (eventName) {
          case 's3:ObjectCreated:*':
            await this.handleObjectCreated(bucket, key);
            break;
          case 's3:ObjectRemoved:*':
            await this.handleObjectRemoved(bucket, key);
            break;
          default:
            console.log(`Unhandled S3 event: ${eventName}`);
        }
      }
    }
  }

  private async handleObjectCreated(bucket: string, key: string) {
    console.log(`Object created: ${bucket}/${key}`);
    // Add your object creation handling logic
  }

  private async handleObjectRemoved(bucket: string, key: string) {
    console.log(`Object removed: ${bucket}/${key}`);
    // Add your object removal handling logic
  }
}
```

## Best Practices

### 1. Error Handling

```typescript
async safeS3Operation<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation();
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      console.warn('S3 object not found');
      return null;
    } else if (error.name === 'NoSuchBucket') {
      console.error('S3 bucket does not exist');
      throw new Error('Bucket not found');
    } else {
      console.error('S3 operation failed:', error);
      throw error;
    }
  }
}
```

### 2. File Validation

```typescript
validateFile(file: Buffer, allowedTypes: string[] = ['image/jpeg', 'image/png']): boolean {
  // Implement file validation logic
  return true;
}
```

### 3. Cost Optimization

```typescript
// Use appropriate storage classes
const getStorageClassForFile = (fileType: string, accessFrequency: 'frequent' | 'infrequent' | 'archive') => {
  switch (accessFrequency) {
    case 'frequent':
      return 'STANDARD';
    case 'infrequent':
      return 'STANDARD_IA';
    case 'archive':
      return 'GLACIER';
    default:
      return 'STANDARD';
  }
};
```

## Testing

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServerAwsS3Module } from '@onivoro/server-aws-s3';
import { S3Client } from '@aws-sdk/client-s3';

describe('S3Client', () => {
  let s3Client: S3Client;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServerAwsS3Module.configure({
        AWS_REGION: 'us-east-1',
        AWS_BUCKET: 'test-bucket',
        AWS_PROFILE: 'test'
      })],
    }).compile();

    s3Client = module.get<S3Client>(S3Client);
  });

  it('should be defined', () => {
    expect(s3Client).toBeDefined();
  });
});
```

## API Reference

### Exported Classes
- `ServerAwsS3Config`: Configuration class for S3 settings
- `ServerAwsS3Module`: NestJS module for S3 integration

### Exported Services
- `S3Client`: AWS S3 client instance (from @aws-sdk/client-s3)

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.
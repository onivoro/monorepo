# @onivoro/server-aws-s3

AWS S3 integration for NestJS applications with file upload/download capabilities.

## Installation

```bash
npm install @onivoro/server-aws-s3
```

## Overview

This library provides AWS S3 integration for NestJS applications, offering file upload, download, deletion, and pre-signed URL generation.

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsS3Module } from '@onivoro/server-aws-s3';

@Module({
  imports: [
    ServerAwsS3Module.configure()
  ]
})
export class AppModule {}
```

## Configuration

The module uses environment-based configuration:

```typescript
export class ServerAwsS3Config {
  AWS_REGION: string;
  AWS_PROFILE?: string;  // Optional AWS profile
  AWS_S3_BUCKET: string;  // Default bucket name
  AWS_S3_PREFIX?: string; // Optional prefix for all keys
}
```

## Service

### S3Service

The service provides file operations:

```typescript
import { Injectable } from '@nestjs/common';
import { S3Service } from '@onivoro/server-aws-s3';

@Injectable()
export class FileStorageService {
  constructor(private readonly s3Service: S3Service) {}

  // Upload a file
  async uploadFile(key: string, body: Buffer | string, contentType: string) {
    const result = await this.s3Service.upload(key, body, contentType);
    return result;
  }

  // Upload a public file
  async uploadPublicFile(key: string, body: Buffer | string, contentType: string) {
    const result = await this.s3Service.uploadPublic(key, body, contentType);
    return result;
  }

  // Download a file
  async downloadFile(key: string) {
    const fileContent = await this.s3Service.download(key);
    return fileContent;
  }

  // Get a pre-signed download URL
  async getDownloadUrl(key: string, expiresIn: number = 3600) {
    const url = await this.s3Service.getPresignedDownloadUrl(key, expiresIn);
    return url;
  }

  // Delete a single file
  async deleteFile(key: string) {
    await this.s3Service.delete(key);
  }

  // Delete files by prefix
  async deleteFilesByPrefix(prefix: string) {
    await this.s3Service.deleteByPrefix(prefix);
  }
}
```

## Available Methods

### Upload Operations
- **upload(key: string, body: Buffer | string, contentType: string, bucket?: string)** - Upload a private file
- **uploadPublic(key: string, body: Buffer | string, contentType: string, bucket?: string)** - Upload a publicly accessible file

### Download Operations
- **download(key: string, bucket?: string)** - Download file content
- **getPresignedDownloadUrl(key: string, expiresInSeconds?: number, bucket?: string)** - Generate pre-signed download URL

### Delete Operations
- **delete(key: string, bucket?: string)** - Delete a single object
- **deleteByPrefix(prefix: string, bucket?: string)** - Delete all objects with a specific prefix

## Direct Client Access

The service exposes the underlying S3 client for advanced operations:

```typescript
import { 
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
  GetObjectTaggingCommand
} from '@aws-sdk/client-s3';

@Injectable()
export class AdvancedS3Service {
  constructor(private readonly s3Service: S3Service) {}

  // List objects in bucket
  async listObjects(prefix?: string) {
    const command = new ListObjectsV2Command({
      Bucket: process.env.AWS_S3_BUCKET,
      Prefix: prefix
    });
    
    return await this.s3Service.s3Client.send(command);
  }

  // Copy object
  async copyObject(sourceKey: string, destinationKey: string) {
    const command = new CopyObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      CopySource: `${process.env.AWS_S3_BUCKET}/${sourceKey}`,
      Key: destinationKey
    });
    
    return await this.s3Service.s3Client.send(command);
  }

  // Get object metadata
  async getObjectMetadata(key: string) {
    const command = new HeadObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key
    });
    
    return await this.s3Service.s3Client.send(command);
  }
}
```

## Complete Example

```typescript
import { Module, Injectable, Controller, Post, Get, Delete, Param, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ServerAwsS3Module, S3Service } from '@onivoro/server-aws-s3';

@Module({
  imports: [ServerAwsS3Module.configure()],
  controllers: [DocumentController],
  providers: [DocumentService]
})
export class DocumentModule {}

@Injectable()
export class DocumentService {
  constructor(private readonly s3Service: S3Service) {}

  async uploadDocument(userId: string, file: Express.Multer.File) {
    const key = `documents/${userId}/${Date.now()}-${file.originalname}`;
    
    try {
      // Upload to S3
      const result = await this.s3Service.upload(
        key,
        file.buffer,
        file.mimetype
      );

      return {
        key,
        location: result.Location,
        etag: result.ETag
      };
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  async getDocumentUrl(key: string) {
    // Generate URL valid for 1 hour
    const url = await this.s3Service.getPresignedDownloadUrl(key, 3600);
    return { url };
  }

  async deleteUserDocuments(userId: string) {
    const prefix = `documents/${userId}/`;
    await this.s3Service.deleteByPrefix(prefix);
  }

  async uploadPublicAvatar(userId: string, imageBuffer: Buffer) {
    const key = `avatars/${userId}.jpg`;
    
    const result = await this.s3Service.uploadPublic(
      key,
      imageBuffer,
      'image/jpeg'
    );

    return {
      key,
      publicUrl: result.Location
    };
  }
}

@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File
  ) {
    const userId = 'user123'; // Get from auth context
    return await this.documentService.uploadDocument(userId, file);
  }

  @Get(':key/url')
  async getDocumentUrl(@Param('key') key: string) {
    return await this.documentService.getDocumentUrl(key);
  }

  @Delete('user/:userId')
  async deleteUserDocuments(@Param('userId') userId: string) {
    await this.documentService.deleteUserDocuments(userId);
    return { message: 'Documents deleted successfully' };
  }
}
```

## Environment Variables

```bash
# Required
AWS_REGION=us-east-1
AWS_S3_BUCKET=my-bucket-name

# Optional
AWS_PROFILE=my-profile
AWS_S3_PREFIX=my-app/  # Prefix for all keys
```

## Error Handling

```typescript
try {
  await s3Service.download('non-existent-key');
} catch (error) {
  if (error.name === 'NoSuchKey') {
    console.error('File not found');
  } else if (error.name === 'AccessDenied') {
    console.error('Permission denied');
  }
}
```

## Limitations

- No multipart upload support (large files must be handled manually)
- No built-in bucket management operations
- No object tagging or versioning support
- Limited to basic CRUD operations
- For advanced features, use the exposed `s3Client` directly

## Best Practices

1. **Key Naming**: Use a consistent key naming strategy (e.g., `type/userId/timestamp-filename`)
2. **Content Types**: Always specify correct content types for proper browser handling
3. **Security**: Use pre-signed URLs for temporary access instead of public uploads when possible
4. **Cleanup**: Implement lifecycle policies for automatic object expiration
5. **Error Handling**: Always handle S3 errors appropriately

## License

MIT
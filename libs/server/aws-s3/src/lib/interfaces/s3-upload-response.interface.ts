export interface IS3UploadResponse {
    Location: string;
    Bucket: string;
    Key: string;
    ETag?: string | undefined;
  }
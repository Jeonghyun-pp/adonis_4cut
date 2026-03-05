import type { StorageAdapter } from './types';

// Stub S3/R2 adapter - implement when real credentials are available.
// Uses the same interface as LocalStorageAdapter.
export class S3StorageAdapter implements StorageAdapter {
  // TODO: Initialize S3 client using env vars:
  // S3_BUCKET, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_ENDPOINT

  async putBuffer(key: string, _buffer: Buffer, _contentType: string): Promise<string> {
    // TODO: Upload buffer to S3 bucket
    // const command = new PutObjectCommand({ Bucket, Key: key, Body: buffer, ContentType });
    // await s3Client.send(command);
    // return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    throw new Error(`S3 storage not configured. Key: ${key}. Set S3_* env vars.`);
  }

  async putFile(key: string, _filepath: string, _contentType: string): Promise<string> {
    throw new Error(`S3 storage not configured. Key: ${key}. Set S3_* env vars.`);
  }

  async getBuffer(_key: string): Promise<Buffer | null> {
    // TODO: GetObjectCommand
    throw new Error('S3 storage not configured.');
  }

  getFilePath(_url: string): string | null {
    return null; // S3 URLs are remote
  }
}

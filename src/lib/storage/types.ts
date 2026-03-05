export interface StorageAdapter {
  putBuffer(key: string, buffer: Buffer, contentType: string): Promise<string>;
  putFile(key: string, filepath: string, contentType: string): Promise<string>;
  getBuffer(key: string): Promise<Buffer | null>;
  getFilePath(url: string): string | null;
}

import fs from 'fs/promises';
import path from 'path';
import type { StorageAdapter } from './types';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export class LocalStorageAdapter implements StorageAdapter {
  async putBuffer(key: string, buffer: Buffer, _contentType: string): Promise<string> {
    const filePath = path.join(UPLOAD_DIR, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return `/uploads/${key}`;
  }

  async putFile(key: string, filepath: string, _contentType: string): Promise<string> {
    const buffer = await fs.readFile(filepath);
    return this.putBuffer(key, buffer, _contentType);
  }

  async getBuffer(key: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(UPLOAD_DIR, key);
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  getFilePath(url: string): string | null {
    if (url.startsWith('/uploads/')) {
      return path.join(UPLOAD_DIR, url.replace('/uploads/', ''));
    }
    return null;
  }
}

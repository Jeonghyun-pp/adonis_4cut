import { prisma } from '@/lib/prisma';
import type { StorageAdapter } from './types';

export class DbStorageAdapter implements StorageAdapter {
  async putBuffer(key: string, buffer: Buffer, contentType: string): Promise<string> {
    await prisma.upload.upsert({
      where: { key },
      update: { data: buffer, contentType },
      create: { key, data: buffer, contentType },
    });
    return `/uploads/${key}`;
  }

  async putFile(key: string, filepath: string, contentType: string): Promise<string> {
    const fs = await import('fs/promises');
    const buffer = await fs.readFile(filepath);
    return this.putBuffer(key, Buffer.from(buffer), contentType);
  }

  async getBuffer(key: string): Promise<Buffer | null> {
    const upload = await prisma.upload.findUnique({ where: { key } });
    return upload ? Buffer.from(upload.data) : null;
  }

  getFilePath(_url: string): string | null {
    return null;
  }
}

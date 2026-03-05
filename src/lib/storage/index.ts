import type { StorageAdapter } from './types';
import { LocalStorageAdapter } from './local';
import { S3StorageAdapter } from './s3';
import { DbStorageAdapter } from './db';

let _storage: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!_storage) {
    const driver = process.env.STORAGE_DRIVER || 'db';
    _storage = driver === 's3' ? new S3StorageAdapter() :
               driver === 'local' ? new LocalStorageAdapter() :
               new DbStorageAdapter();
  }
  return _storage;
}

export type { StorageAdapter };

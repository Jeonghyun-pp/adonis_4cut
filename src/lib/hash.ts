import crypto from 'crypto';

export function computeInputHash(
  frameId: string,
  photoHashes: string[],
  transforms: unknown[],
  format: string
): string {
  const data = JSON.stringify({ frameId, photoHashes, transforms, format });
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function hashBuffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

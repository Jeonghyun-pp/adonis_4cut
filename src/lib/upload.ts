import sharp from 'sharp';

const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB raw upload limit
const MAX_DIMENSION = 4096; // max width/height after processing

export async function validateAndProcessUpload(
  buffer: Buffer,
  mimeType: string,
  opts?: { allowedMimes?: string[]; stripMeta?: boolean }
): Promise<Buffer> {
  const allowed = opts?.allowedMimes || ALLOWED_MIMES;

  if (!allowed.includes(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Allowed: ${allowed.join(', ')}`);
  }

  if (buffer.length > MAX_SIZE) {
    throw new Error(`File too large: ${buffer.length} bytes. Max: ${MAX_SIZE}`);
  }

  // Auto-orient, strip EXIF, and resize if too large
  let pipeline = sharp(buffer).rotate();

  const metadata = await sharp(buffer).metadata();
  if (metadata.width && metadata.width > MAX_DIMENSION || metadata.height && metadata.height > MAX_DIMENSION) {
    pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true });
  }

  // PNG은 투명도 유지, 나머지는 JPEG 압축
  if (mimeType === 'image/png') {
    buffer = await pipeline.png().toBuffer();
  } else {
    buffer = await pipeline.jpeg({ quality: 90 }).toBuffer();
  }

  return buffer;
}

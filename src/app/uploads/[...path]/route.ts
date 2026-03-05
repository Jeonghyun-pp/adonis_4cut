export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import path from 'path';

export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } }
) {
  const key = params.path.join('/');
  const storage = getStorage();
  const buffer = await storage.getBuffer(key);

  if (!buffer) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ext = path.extname(key).toLowerCase();
  const contentType =
    ext === '.png' ? 'image/png' :
    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
    ext === '.webp' ? 'image/webp' :
    'application/octet-stream';

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

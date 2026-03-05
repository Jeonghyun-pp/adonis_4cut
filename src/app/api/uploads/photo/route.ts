export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { validateAndProcessUpload } from '@/lib/upload';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'image/png';
    const validated = await validateAndProcessUpload(buffer, mimeType);

    const key = `photos/${crypto.randomUUID()}.jpg`;
    const storage = getStorage();
    const url = await storage.putBuffer(key, validated, 'image/jpeg');

    return NextResponse.json({ url });
  } catch (err: any) {
    console.error('Upload photo error:', err);
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}

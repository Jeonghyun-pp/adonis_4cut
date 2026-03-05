export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { computeInputHash, hashBuffer } from '@/lib/hash';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateAndProcessUpload } from '@/lib/upload';
import { log } from '@/lib/logger';
import { z } from 'zod';
import crypto from 'crypto';

const transformSchema = z.object({
  scale: z.number().min(0.1).max(5).default(1),
  tx: z.number().default(0),
  ty: z.number().default(0),
});

const enqueueSchema = z.object({
  frameId: z.string(),
  transforms: z.array(transformSchema).length(4),
  format: z.enum(['png', 'jpg']).default('png'),
});

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const formData = await req.formData();
  const metaRaw = formData.get('meta') as string;
  if (!metaRaw) {
    return NextResponse.json({ error: 'Missing meta field' }, { status: 400 });
  }

  const meta = enqueueSchema.parse(JSON.parse(metaRaw));

  // Validate frame exists
  const frame = await prisma.frame.findUnique({
    where: { id: meta.frameId },
    include: { slots: true },
  });
  if (!frame) {
    return NextResponse.json({ error: 'Frame not found' }, { status: 404 });
  }

  // Process photos
  const photoUrls: string[] = [];
  const photoHashes: string[] = [];
  const storage = getStorage();

  for (let i = 0; i < 4; i++) {
    const file = formData.get(`photo_${i}`) as File | null;
    if (!file) {
      return NextResponse.json({ error: `Missing photo_${i}` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validated = await validateAndProcessUpload(buffer, file.type);
    const hash = hashBuffer(validated);
    photoHashes.push(hash);

    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const key = `photos/${crypto.randomUUID()}.${ext}`;
    const url = await storage.putBuffer(key, validated, file.type);
    photoUrls.push(url);
  }

  // Compute cache hash
  const inputHash = computeInputHash(meta.frameId, photoHashes, meta.transforms, meta.format);

  // Check cache
  const existing = await prisma.renderJob.findFirst({
    where: { inputHash, status: 'done' },
  });

  if (existing) {
    log('render', 'cache-hit', { jobId: existing.id });
    return NextResponse.json({
      jobId: existing.id,
      status: 'done',
      resultUrl: existing.resultUrl,
    });
  }

  // Create job
  const job = await prisma.renderJob.create({
    data: {
      frameId: meta.frameId,
      personId: frame.personId,
      inputHash,
      status: 'queued',
      format: meta.format,
      assets: {
        create: [
          ...photoUrls.map((url, i) => ({ kind: `photo_${i + 1}`, url })),
          ...meta.transforms.map((t, i) => ({ kind: `transform_${i}`, url: JSON.stringify(t) })),
        ],
      },
    },
  });

  log('render', 'enqueued', { jobId: job.id, inputHash });

  return NextResponse.json({ jobId: job.id, status: 'queued' });
}

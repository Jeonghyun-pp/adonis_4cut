export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const frameSchema = z.object({
  id: z.string().optional(),
  personId: z.string(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  overlayUrl: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = frameSchema.parse(await req.json());

    if (body.id) {
      const frame = await prisma.frame.update({
        where: { id: body.id },
        data: {
          overlayUrl: body.overlayUrl,
          width: body.width,
          height: body.height,
        },
      });
      return NextResponse.json(frame);
    }

    const maxVersion = await prisma.frame.aggregate({
      where: { personId: body.personId },
      _max: { version: true },
    });

    const frame = await prisma.frame.create({
      data: {
        personId: body.personId,
        version: (maxVersion._max.version || 0) + 1,
        overlayUrl: body.overlayUrl,
        width: body.width || 1200,
        height: body.height || 1800,
      },
    });

    return NextResponse.json(frame);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save frame' }, { status: 500 });
  }
}

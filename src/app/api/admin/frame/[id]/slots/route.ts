import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const slotSchema = z.object({
  id: z.string().optional(),
  index: z.number().int().min(1).max(4),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  fitMode: z.enum(['cover', 'contain']).default('cover'),
  rotation: z.number().default(0),
  borderRadius: z.number().int().default(0),
  maskUrl: z.string().nullable().optional(),
  overlayUrl: z.string().nullable().optional(),
  zIndex: z.number().int().default(0),
});

const slotsSchema = z.object({
  slots: z.array(slotSchema),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const frameId = params.id;
    const body = slotsSchema.parse(await req.json());

    await prisma.frameSlot.deleteMany({ where: { frameId } });

    const slots = await Promise.all(
      body.slots.map((slot) =>
        prisma.frameSlot.create({
          data: {
            frameId,
            index: slot.index,
            x: slot.x,
            y: slot.y,
            w: slot.w,
            h: slot.h,
            fitMode: slot.fitMode,
            rotation: slot.rotation,
            borderRadius: slot.borderRadius,
            maskUrl: slot.maskUrl || null,
            overlayUrl: slot.overlayUrl || null,
            zIndex: slot.zIndex,
          },
        })
      )
    );

    return NextResponse.json(slots);
  } catch (err: any) {
    console.error('Save slots error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save slots' }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const slots = await prisma.frameSlot.findMany({
      where: { frameId: params.id },
      orderBy: { index: 'asc' },
    });
    return NextResponse.json(slots);
  } catch (err: any) {
    console.error('Get slots error:', err);
    return NextResponse.json({ error: err.message || 'Failed to load slots' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const frame = await prisma.frame.findUnique({ where: { id: params.id } });
    if (!frame) {
      return NextResponse.json({ error: 'Frame not found' }, { status: 404 });
    }

    await prisma.frame.updateMany({
      where: { personId: frame.personId },
      data: { isActive: false },
    });

    const updated = await prisma.frame.update({
      where: { id: params.id },
      data: { isActive: true },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('Activate frame error:', err);
    return NextResponse.json({ error: err.message || 'Failed to activate' }, { status: 500 });
  }
}

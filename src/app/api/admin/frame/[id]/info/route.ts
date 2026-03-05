export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const frame = await prisma.frame.findUnique({
    where: { id: params.id },
    select: { id: true, width: true, height: true, overlayUrl: true, version: true, isActive: true },
  });

  if (!frame) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(frame);
}

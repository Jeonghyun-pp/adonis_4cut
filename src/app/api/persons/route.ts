import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const persons = await prisma.person.findMany({
    where: { isActive: true },
    include: {
      frames: {
        where: { isActive: true },
        select: { id: true, version: true, width: true, height: true, overlayUrl: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(persons);
}

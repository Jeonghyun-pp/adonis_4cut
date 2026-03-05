import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const person = await prisma.person.findUnique({
    where: { slug: params.slug },
    include: {
      frames: {
        where: { isActive: true },
        include: { slots: { orderBy: { index: 'asc' } } },
        take: 1,
      },
    },
  });

  if (!person) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(person);
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const personSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  thumbnailUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const body = personSchema.parse(await req.json());

    if (body.id) {
      const person = await prisma.person.update({
        where: { id: body.id },
        data: {
          name: body.name,
          slug: body.slug,
          thumbnailUrl: body.thumbnailUrl,
          isActive: body.isActive,
        },
      });
      return NextResponse.json(person);
    }

    const person = await prisma.person.create({
      data: {
        name: body.name,
        slug: body.slug,
        thumbnailUrl: body.thumbnailUrl,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json(person);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save person' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await prisma.person.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const persons = await prisma.person.findMany({
      include: { frames: { select: { id: true, version: true, isActive: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(persons);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load persons' }, { status: 500 });
  }
}

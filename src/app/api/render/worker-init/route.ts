export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { ensureDevWorker } from '@/lib/queue/devWorker';

// This endpoint is hit once on app startup to start the dev worker
export async function GET() {
  ensureDevWorker();
  return NextResponse.json({ ok: true });
}

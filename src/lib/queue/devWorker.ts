import { prisma } from '@/lib/prisma';
import { startWorkerLoop } from './worker';

let started = false;

export function ensureDevWorker() {
  if (started) return;
  if (process.env.NODE_ENV === 'production') return;
  started = true;
  startWorkerLoop(prisma);
}

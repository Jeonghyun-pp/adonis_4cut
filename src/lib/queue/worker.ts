import { PrismaClient } from '@prisma/client';
import { renderFrame } from '@/lib/render/renderFrame';
import { log } from '@/lib/logger';

const CONCURRENCY = parseInt(process.env.RENDER_CONCURRENCY || '2', 10);
const POLL_INTERVAL = 2000;

let activeJobs = 0;

export async function processNextJob(prisma: PrismaClient): Promise<boolean> {
  if (activeJobs >= CONCURRENCY) return false;

  // Atomically claim a job
  const jobs = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `UPDATE "RenderJob" SET status = 'processing', "updatedAt" = NOW()
     WHERE id = (
       SELECT id FROM "RenderJob" WHERE status = 'queued'
       ORDER BY "createdAt" ASC LIMIT 1
       FOR UPDATE SKIP LOCKED
     ) RETURNING id`
  );

  if (jobs.length === 0) return false;

  const jobId = jobs[0].id;
  activeJobs++;

  log('worker', 'claimed', { jobId });

  try {
    const resultUrl = await renderFrame(jobId);
    await prisma.renderJob.update({
      where: { id: jobId },
      data: { status: 'done', progress: 100, resultUrl },
    });
    log('worker', 'completed', { jobId, resultUrl });
  } catch (err: any) {
    log('worker', 'failed', { jobId, error: err.message });
    await prisma.renderJob.update({
      where: { id: jobId },
      data: { status: 'failed', error: err.message },
    });
  } finally {
    activeJobs--;
  }

  return true;
}

export async function startWorkerLoop(prisma: PrismaClient) {
  log('worker', 'starting', { concurrency: CONCURRENCY });

  const poll = async () => {
    try {
      const processed = await processNextJob(prisma);
      if (processed) {
        // Immediately try the next one
        setImmediate(poll);
        return;
      }
    } catch (err: any) {
      log('worker', 'poll-error', { error: err.message });
    }
    setTimeout(poll, POLL_INTERVAL);
  };

  poll();
}

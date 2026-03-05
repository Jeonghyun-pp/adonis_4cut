import { PrismaClient } from '@prisma/client';

// Standalone worker process for production use
// Run: npm run worker

// Dynamic import to avoid module resolution issues with path aliases
async function main() {
  const prisma = new PrismaClient();
  const { startWorkerLoop } = await import('../src/lib/queue/worker');

  console.log('Starting standalone render worker...');
  await startWorkerLoop(prisma);
}

main().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});

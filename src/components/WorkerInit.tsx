'use client';

import { useEffect } from 'react';

export function WorkerInit() {
  useEffect(() => {
    // Trigger dev worker start on first page load
    fetch('/api/render/worker-init').catch(() => {});
  }, []);

  return null;
}

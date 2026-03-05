'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface JobData {
  id: string;
  status: string;
  resultUrl: string | null;
}

export default function PublicResultPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [job, setJob] = useState<JobData | null>(null);

  useEffect(() => {
    fetch(`/api/render/status?jobId=${jobId}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setJob)
      .catch(() => {});
  }, [jobId]);

  if (!job) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>;

  if (job.status !== 'done' || !job.resultUrl) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Image not available
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
      <h1 className="text-xl font-bold mb-4">Your Photo</h1>
      <img
        src={job.resultUrl}
        alt="Photobooth result"
        className="max-w-full max-h-[75vh] rounded-lg shadow-lg"
      />
      <a
        href={job.resultUrl}
        download={`photobooth-${jobId}.png`}
        className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
      >
        Download
      </a>
    </div>
  );
}

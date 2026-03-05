'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface JobData {
  id: string;
  status: string;
  progress: number;
  resultUrl: string | null;
  error: string | null;
}

export default function ResultPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [job, setJob] = useState<JobData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const poll = async () => {
      const res = await fetch(`/api/render/status?jobId=${jobId}`);
      if (!res.ok) return;
      const data = await res.json();
      setJob(data);

      if (data.status === 'queued' || data.status === 'processing') {
        setTimeout(poll, 1500);
      }
    };
    poll();
  }, [jobId]);

  useEffect(() => {
    if (job?.status === 'done') {
      const publicUrl = `${window.location.origin}/r/${jobId}`;
      import('qrcode').then((QRCode) => {
        QRCode.toDataURL(publicUrl, { width: 200, margin: 2 }).then(setQrDataUrl);
      });
    }
  }, [job, jobId]);

  if (!job) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  if (job.status === 'failed') {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Render Failed</h1>
        <p className="text-gray-600 mb-4">{job.error}</p>
        <Link href="/" className="text-blue-500 underline">Go back</Link>
      </div>
    );
  }

  if (job.status !== 'done') {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-lg text-gray-600">Rendering... {job.progress}%</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 text-center">
      <h1 className="text-2xl font-bold mb-6">Your Photo Strip!</h1>

      <div className="bg-white rounded-xl shadow-lg p-4 inline-block">
        <img
          src={job.resultUrl!}
          alt="Final result"
          className="max-w-full max-h-[70vh] rounded"
        />
      </div>

      <div className="mt-6 flex flex-col items-center gap-4">
        <a
          href={job.resultUrl!}
          download={`photobooth-${jobId}.png`}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Download Image
        </a>

        {qrDataUrl && (
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-2">Scan to download on your phone</p>
            <img src={qrDataUrl} alt="QR Code" className="mx-auto" />
          </div>
        )}

        <Link href="/" className="text-gray-500 hover:text-gray-700 transition mt-4">
          Take more photos
        </Link>
      </div>
    </div>
  );
}

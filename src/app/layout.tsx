import type { Metadata } from 'next';
import './globals.css';
import { WorkerInit } from '@/components/WorkerInit';

export const metadata: Metadata = {
  title: 'Photobooth - 인생네컷',
  description: 'Take 4 photos and create your own photobooth strip!',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <WorkerInit />
        {children}
      </body>
    </html>
  );
}

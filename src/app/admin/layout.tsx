'use client';

import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center gap-6">
        <Link href="/admin" className="font-bold text-lg">Admin</Link>
        <Link href="/admin/persons" className="text-gray-600 hover:text-gray-900">Persons</Link>
        <Link href="/admin/frames" className="text-gray-600 hover:text-gray-900">Frames</Link>
        <div className="flex-1" />
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">Back to site</Link>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}

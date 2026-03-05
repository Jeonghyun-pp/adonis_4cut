'use client';

import Link from 'next/link';

export default function AdminDashboard() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/admin/persons"
          className="bg-white p-6 rounded-xl shadow hover:shadow-md transition"
        >
          <h2 className="font-semibold text-lg">Persons / Themes</h2>
          <p className="text-gray-500 text-sm mt-1">Manage person entries</p>
        </Link>
        <Link
          href="/admin/frames"
          className="bg-white p-6 rounded-xl shadow hover:shadow-md transition"
        >
          <h2 className="font-semibold text-lg">Frames</h2>
          <p className="text-gray-500 text-sm mt-1">Upload frames and edit slots</p>
        </Link>
      </div>
    </div>
  );
}

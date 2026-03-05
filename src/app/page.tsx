'use client';

import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-gray-100 px-4">
      <h1 className="text-5xl font-bold mb-4">Adonis 4Cut</h1>
      <p className="text-gray-500 mb-12 text-lg">What would you like to do?</p>

      <div className="flex flex-col sm:flex-row gap-6">
        <button
          onClick={() => router.push('/create')}
          className="px-12 py-8 bg-white border-2 border-gray-200 rounded-2xl hover:border-black hover:shadow-lg active:scale-95 transition-all flex flex-col items-center gap-3"
        >
          <span className="text-4xl">+</span>
          <span className="text-xl font-bold">Create Frame</span>
          <span className="text-sm text-gray-400">Upload photo & make a frame</span>
        </button>

        <button
          onClick={() => router.push('/persons')}
          className="px-12 py-8 bg-black text-white rounded-2xl hover:bg-gray-800 hover:shadow-lg active:scale-95 transition-all flex flex-col items-center gap-3"
        >
          <span className="text-4xl">@</span>
          <span className="text-xl font-bold">Take Photos</span>
          <span className="text-sm text-gray-300">Choose a person & shoot</span>
        </button>
      </div>
    </div>
  );
}

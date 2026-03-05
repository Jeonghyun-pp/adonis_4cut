'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Person {
  id: string;
  name: string;
  slug: string;
  thumbnailUrl: string | null;
  frames: { id: string; overlayUrl: string }[];
}

export default function PersonsPage() {
  const router = useRouter();
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/persons')
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => { setPersons(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link href="/" className="text-gray-400 hover:text-gray-600 transition text-sm mb-6 inline-block">
        &larr; Back
      </Link>
      <h1 className="text-3xl font-bold text-center mb-2">Choose Your Character</h1>
      <p className="text-center text-gray-500 mb-8">Select a person to start shooting!</p>

      {loading ? (
        <div className="text-center text-gray-400">Loading...</div>
      ) : persons.length === 0 ? (
        <div className="text-center text-gray-400">
          No characters available.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {persons.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/camera?person=${p.slug}`)}
              className="group block bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden text-left"
            >
              <div className="aspect-[3/4] bg-gray-100 relative">
                {p.thumbnailUrl ? (
                  <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : p.frames[0]?.overlayUrl ? (
                  <img src={p.frames[0].overlayUrl} alt={p.name} className="w-full h-full object-contain p-4" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-300 text-6xl">
                    ?
                  </div>
                )}
              </div>
              <div className="p-4 text-center">
                <h2 className="font-semibold text-lg group-hover:text-blue-600 transition">{p.name}</h2>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

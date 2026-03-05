'use client';

import { useEffect, useState } from 'react';

interface Person {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  frames: { id: string; version: number; isActive: boolean }[];
}

export default function PersonsPage() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadPersons = () => {
    fetch('/api/admin/person')
      .then((r) => r.ok ? r.json() : Promise.reject('API error'))
      .then((data) => { if (Array.isArray(data)) setPersons(data); })
      .catch(() => setPersons([]));
  };

  useEffect(() => { loadPersons(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/admin/person', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId || undefined, name, slug }),
    });
    setName('');
    setSlug('');
    setEditingId(null);
    loadPersons();
  };

  const startEdit = (p: Person) => {
    setEditingId(p.id);
    setName(p.name);
    setSlug(p.slug);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Persons / Themes</h1>

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow mb-6 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          {editingId ? 'Update' : 'Create'}
        </button>
        {editingId && (
          <button type="button" onClick={() => { setEditingId(null); setName(''); setSlug(''); }}
            className="px-4 py-2 bg-gray-200 rounded-lg">
            Cancel
          </button>
        )}
      </form>

      <div className="space-y-3">
        {persons.map((p) => (
          <div key={p.id} className="bg-white p-4 rounded-xl shadow flex items-center justify-between">
            <div>
              <span className="font-medium">{p.name}</span>
              <span className="text-gray-400 text-sm ml-2">/{p.slug}</span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {p.isActive ? 'Active' : 'Inactive'}
              </span>
              <span className="text-gray-400 text-sm ml-2">{p.frames.length} frames</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(p)} className="text-blue-500 hover:text-blue-700 text-sm">
                Edit
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`"${p.name}" 및 관련 프레임을 모두 삭제하시겠습니까?`)) return;
                  await fetch('/api/admin/person', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: p.id }),
                  });
                  loadPersons();
                }}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

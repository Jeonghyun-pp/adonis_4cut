'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Person { id: string; name: string; slug: string }
interface Frame {
  id: string;
  personId: string;
  version: number;
  width: number;
  height: number;
  overlayUrl: string;
  isActive: boolean;
}

export default function FramesPage() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [overlayUrl, setOverlayUrl] = useState('');
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(1800);
  const [uploading, setUploading] = useState(false);

  const loadFrames = async () => {
    const res = await fetch('/api/admin/person');
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data)) return;
    setPersons(data);
    const all: Frame[] = [];
    data.forEach((p: any) => {
      if (p.frames) all.push(...p.frames.map((f: any) => ({ ...f, personId: p.id })));
    });
    setFrames(all);
  };

  useEffect(() => { loadFrames(); }, []);

  const handleUploadOverlay = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/uploads/frame', { method: 'POST', body: formData });
    if (!res.ok) { setUploading(false); return; }
    const data = await res.json();
    setOverlayUrl(data.url);
    setUploading(false);
  };

  const handleCreateFrame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonId || !overlayUrl) return;
    await fetch('/api/admin/frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: selectedPersonId, overlayUrl, width, height }),
    });
    setOverlayUrl('');
    loadFrames();
  };

  const handleActivate = async (frameId: string) => {
    await fetch(`/api/admin/frame/${frameId}/activate`, { method: 'POST' });
    loadFrames();
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Frames</h1>

      <form onSubmit={handleCreateFrame} className="bg-white p-4 rounded-xl shadow mb-6 space-y-3">
        <h2 className="font-medium">Create New Frame</h2>
        <div className="flex gap-3">
          <select
            value={selectedPersonId}
            onChange={(e) => setSelectedPersonId(e.target.value)}
            className="px-3 py-2 border rounded-lg"
            required
          >
            <option value="">Select Person</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input type="number" value={width} onChange={(e) => setWidth(+e.target.value)}
            className="px-3 py-2 border rounded-lg w-24" placeholder="Width" />
          <input type="number" value={height} onChange={(e) => setHeight(+e.target.value)}
            className="px-3 py-2 border rounded-lg w-24" placeholder="Height" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Overlay PNG</label>
          <input type="file" accept="image/png" onChange={handleUploadOverlay} />
          {uploading && <span className="text-sm text-gray-400 ml-2">Uploading...</span>}
          {overlayUrl && <img src={overlayUrl} alt="Overlay" className="mt-2 h-24 border rounded" />}
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Create Frame
        </button>
      </form>

      <div className="space-y-3">
        {frames.map((f) => {
          const person = persons.find((p) => p.id === f.personId);
          return (
            <div key={f.id} className="bg-white p-4 rounded-xl shadow flex items-center gap-4">
              <img src={f.overlayUrl} alt="overlay" className="w-16 h-24 object-contain border rounded" />
              <div className="flex-1">
                <p className="font-medium">{person?.name || 'Unknown'} - v{f.version}</p>
                <p className="text-gray-400 text-sm">{f.width}x{f.height}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${f.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {f.isActive ? 'Active' : 'Inactive'}
              </span>
              {!f.isActive && (
                <button onClick={() => handleActivate(f.id)} className="text-green-600 hover:text-green-800 text-sm">
                  Activate
                </button>
              )}
              <Link href={`/admin/frames/${f.id}`} className="text-blue-500 hover:text-blue-700 text-sm">
                Edit Slots
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

export default function PreviewPage() {
  const router = useRouter();
  const [photos, setPhotos] = useState<string[]>([]);
  const [frameId, setFrameId] = useState('');
  const [transforms, setTransforms] = useState<Transform[]>([
    { scale: 1, tx: 0, ty: 0 },
    { scale: 1, tx: 0, ty: 0 },
    { scale: 1, tx: 0, ty: 0 },
    { scale: 1, tx: 0, ty: 0 },
  ]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState('');
  const dragRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('photobooth_photos');
    const fId = sessionStorage.getItem('photobooth_frameId');
    if (!stored || !fId) {
      router.push('/persons');
      return;
    }
    setPhotos(JSON.parse(stored));
    setFrameId(fId);
  }, [router]);

  const updateTransform = (index: number, partial: Partial<Transform>) => {
    setTransforms((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...partial };
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const t = transforms[activeSlot];
    dragRef.current = { startX: e.clientX, startY: e.clientY, startTx: t.tx, startTy: t.ty };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    updateTransform(activeSlot, {
      tx: dragRef.current.startTx + dx,
      ty: dragRef.current.startTy + dy,
    });
  };

  const handleMouseUp = () => {
    dragRef.current = null;
  };

  const handleRender = async () => {
    setRendering(true);
    setProgress('Uploading photos...');

    try {
      const formData = new FormData();
      formData.append('meta', JSON.stringify({ frameId, transforms, format: 'png' }));

      for (let i = 0; i < 4; i++) {
        const resp = await fetch(photos[i]);
        const blob = await resp.blob();
        formData.append(`photo_${i}`, blob, `photo_${i}.jpg`);
      }

      setProgress('Enqueuing render...');
      const enqRes = await fetch('/api/render/enqueue', { method: 'POST', body: formData });
      if (!enqRes.ok) { const t = await enqRes.text(); throw new Error(t || 'Render enqueue failed'); }
      const enqData = await enqRes.json();

      if (enqData.status === 'done') {
        router.push(`/result/${enqData.jobId}`);
        return;
      }

      // Poll for completion
      const jobId = enqData.jobId;
      setProgress('Rendering...');

      const poll = async () => {
        const res = await fetch(`/api/render/status?jobId=${jobId}`);
        if (!res.ok) { setProgress('Server error'); setRendering(false); return; }
        const data = await res.json();

        if (data.status === 'done') {
          router.push(`/result/${jobId}`);
        } else if (data.status === 'failed') {
          setProgress(`Render failed: ${data.error}`);
          setRendering(false);
        } else {
          setProgress(`Rendering... ${data.progress || 0}%`);
          setTimeout(poll, 1000);
        }
      };

      poll();
    } catch (err: any) {
      setProgress(`Error: ${err.message}`);
      setRendering(false);
    }
  };

  if (photos.length === 0) return null;

  const t = transforms[activeSlot];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-center mb-6">Adjust Your Photos</h1>

      {/* Slot selector */}
      <div className="flex gap-3 mb-6 justify-center">
        {[0, 1, 2, 3].map((i) => (
          <button
            key={i}
            onClick={() => setActiveSlot(i)}
            className={`w-20 h-20 rounded-lg border-2 overflow-hidden ${
              activeSlot === i ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'
            }`}
          >
            <img src={photos[i]} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="flex gap-8 items-start justify-center">
        <div
          className="w-80 h-80 bg-gray-200 rounded-lg overflow-hidden relative cursor-move select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={photos[activeSlot]}
            alt="Preview"
            className="absolute"
            style={{
              transform: `translate(${t.tx}px, ${t.ty}px) scale(${t.scale})`,
              transformOrigin: 'center',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            draggable={false}
          />
          <div className="absolute inset-0 border-2 border-blue-400 border-dashed pointer-events-none rounded-lg" />
        </div>

        <div className="space-y-4 w-48">
          <div>
            <label className="block text-sm font-medium mb-1">Zoom: {t.scale.toFixed(2)}x</label>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={t.scale}
              onChange={(e) => updateTransform(activeSlot, { scale: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pan X: {t.tx}</label>
            <input
              type="range"
              min="-200"
              max="200"
              value={t.tx}
              onChange={(e) => updateTransform(activeSlot, { tx: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pan Y: {t.ty}</label>
            <input
              type="range"
              min="-200"
              max="200"
              value={t.ty}
              onChange={(e) => updateTransform(activeSlot, { ty: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
          <button
            onClick={() => updateTransform(activeSlot, { scale: 1, tx: 0, ty: 0 })}
            className="w-full py-2 bg-gray-200 rounded hover:bg-gray-300 transition text-sm"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-8 text-center">
        {rendering ? (
          <p className="text-blue-600 font-medium">{progress}</p>
        ) : (
          <button
            onClick={handleRender}
            className="px-8 py-3 bg-green-600 text-white rounded-full text-lg font-semibold hover:bg-green-700 transition"
          >
            Render Final Image
          </button>
        )}
      </div>
    </div>
  );
}

'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';

interface Slot {
  id?: string;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fitMode: 'cover' | 'contain';
  rotation: number;
  borderRadius: number;
  maskUrl: string | null;
  zIndex: number;
}

interface Frame {
  id: string;
  width: number;
  height: number;
  overlayUrl: string;
  version: number;
}

export default function SlotEditorPage() {
  const params = useParams();
  const frameId = params.id as string;
  const [frame, setFrame] = useState<Frame | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<{ type: 'move' | 'resize'; startX: number; startY: number; origSlot: Slot } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    fetch(`/api/admin/frame/${frameId}/slots`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        if (data.length > 0) {
          setSlots(data.map((s: any) => ({
            index: s.index,
            x: s.x,
            y: s.y,
            w: s.w,
            h: s.h,
            fitMode: s.fitMode,
            rotation: s.rotation,
            borderRadius: s.borderRadius,
            maskUrl: s.maskUrl,
            zIndex: s.zIndex,
          })));
        } else {
          setSlots([
            { index: 1, x: 50, y: 50, w: 500, h: 375, fitMode: 'cover', rotation: 0, borderRadius: 0, maskUrl: null, zIndex: 0 },
            { index: 2, x: 650, y: 50, w: 500, h: 375, fitMode: 'cover', rotation: 0, borderRadius: 0, maskUrl: null, zIndex: 0 },
            { index: 3, x: 50, y: 475, w: 500, h: 375, fitMode: 'cover', rotation: 0, borderRadius: 0, maskUrl: null, zIndex: 0 },
            { index: 4, x: 650, y: 475, w: 500, h: 375, fitMode: 'cover', rotation: 0, borderRadius: 0, maskUrl: null, zIndex: 0 },
          ]);
        }
      });
  }, [frameId]);

  useEffect(() => {
    fetch(`/api/admin/frame/${frameId}/info`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setFrame(data); });
  }, [frameId]);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current || !frame) return;
      const containerW = containerRef.current.clientWidth;
      setScale(containerW / frame.width);
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [frame]);

  const handleMouseDown = useCallback((e: React.MouseEvent, slotIdx: number, type: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    setActiveSlot(slotIdx);
    setDragging({
      type,
      startX: e.clientX,
      startY: e.clientY,
      origSlot: { ...slots[slotIdx] },
    });
  }, [slots]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = (e.clientX - dragging.startX) / scale;
    const dy = (e.clientY - dragging.startY) / scale;

    setSlots((prev) => {
      const next = [...prev];
      const s = { ...dragging.origSlot };
      if (dragging.type === 'move') {
        s.x = Math.round(s.x + dx);
        s.y = Math.round(s.y + dy);
      } else {
        s.w = Math.max(50, Math.round(s.w + dx));
        s.h = Math.max(50, Math.round(s.h + dy));
      }
      next[activeSlot] = s;
      return next;
    });
  }, [dragging, activeSlot, scale]);

  const handleMouseUp = () => setDragging(null);

  const updateSlotProp = (key: keyof Slot, value: any) => {
    setSlots((prev) => {
      const next = [...prev];
      next[activeSlot] = { ...next[activeSlot], [key]: value };
      return next;
    });
  };

  const handleUploadMask = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/uploads/mask', { method: 'POST', body: formData });
    if (!res.ok) return;
    const data = await res.json();
    updateSlotProp('maskUrl', data.url);
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/admin/frame/${frameId}/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots }),
    });
    setSaving(false);
  };

  if (!frame) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Slot Editor</h1>
        <p className="text-gray-400">Loading frame...</p>
      </div>
    );
  }

  const currentSlot = slots[activeSlot];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Slot Editor - v{frame.version}</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Slots'}
        </button>
      </div>

      <div className="flex gap-6">
        <div className="flex-1">
          <div
            ref={containerRef}
            className="relative bg-gray-200 border-2 border-gray-300 rounded-lg overflow-hidden select-none"
            style={{ aspectRatio: `${frame.width}/${frame.height}` }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              src={frame.overlayUrl}
              alt="Frame overlay"
              className="absolute inset-0 w-full h-full object-fill pointer-events-none opacity-70"
            />

            {slots.map((slot, idx) => (
              <div
                key={idx}
                className={`absolute border-2 ${
                  idx === activeSlot ? 'border-blue-500 bg-blue-500/20' : 'border-red-400 bg-red-400/10'
                } cursor-move`}
                style={{
                  left: slot.x * scale,
                  top: slot.y * scale,
                  width: slot.w * scale,
                  height: slot.h * scale,
                  borderRadius: slot.borderRadius * scale,
                }}
                onMouseDown={(e) => handleMouseDown(e, idx, 'move')}
              >
                <span className="absolute top-1 left-1 text-xs font-bold bg-white/80 px-1 rounded">
                  {slot.index}
                </span>
                <div
                  className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize"
                  onMouseDown={(e) => handleMouseDown(e, idx, 'resize')}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="w-64 bg-white p-4 rounded-xl shadow space-y-3">
          <h2 className="font-semibold">Slot {currentSlot?.index || '-'}</h2>

          {currentSlot && (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <label className="text-gray-500">X</label>
                  <input type="number" value={currentSlot.x}
                    onChange={(e) => updateSlotProp('x', +e.target.value)}
                    className="w-full px-2 py-1 border rounded" />
                </div>
                <div>
                  <label className="text-gray-500">Y</label>
                  <input type="number" value={currentSlot.y}
                    onChange={(e) => updateSlotProp('y', +e.target.value)}
                    className="w-full px-2 py-1 border rounded" />
                </div>
                <div>
                  <label className="text-gray-500">W</label>
                  <input type="number" value={currentSlot.w}
                    onChange={(e) => updateSlotProp('w', +e.target.value)}
                    className="w-full px-2 py-1 border rounded" />
                </div>
                <div>
                  <label className="text-gray-500">H</label>
                  <input type="number" value={currentSlot.h}
                    onChange={(e) => updateSlotProp('h', +e.target.value)}
                    className="w-full px-2 py-1 border rounded" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500">Fit Mode</label>
                <select
                  value={currentSlot.fitMode}
                  onChange={(e) => updateSlotProp('fitMode', e.target.value)}
                  className="w-full px-2 py-1 border rounded text-sm"
                >
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-500">Rotation</label>
                <input type="number" value={currentSlot.rotation}
                  onChange={(e) => updateSlotProp('rotation', +e.target.value)}
                  className="w-full px-2 py-1 border rounded text-sm" />
              </div>

              <div>
                <label className="block text-sm text-gray-500">Border Radius</label>
                <input type="number" value={currentSlot.borderRadius}
                  onChange={(e) => updateSlotProp('borderRadius', +e.target.value)}
                  className="w-full px-2 py-1 border rounded text-sm" />
              </div>

              <div>
                <label className="block text-sm text-gray-500">Z-Index</label>
                <input type="number" value={currentSlot.zIndex}
                  onChange={(e) => updateSlotProp('zIndex', +e.target.value)}
                  className="w-full px-2 py-1 border rounded text-sm" />
              </div>

              <div>
                <label className="block text-sm text-gray-500">Mask PNG</label>
                <input type="file" accept="image/png" onChange={handleUploadMask} className="text-xs" />
                {currentSlot.maskUrl && (
                  <div className="mt-1 flex items-center gap-2">
                    <img src={currentSlot.maskUrl} alt="mask" className="w-8 h-8 border rounded" />
                    <button onClick={() => updateSlotProp('maskUrl', null)} className="text-red-500 text-xs">Remove</button>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="pt-3 border-t space-y-2">
            <p className="text-xs text-gray-400">Select a slot by clicking on the canvas or use buttons:</p>
            <div className="flex gap-1">
              {slots.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSlot(i)}
                  className={`px-3 py-1 rounded text-sm ${i === activeSlot ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Step = 'upload' | 'arrange' | 'position' | 'save';

interface SlotImage {
  originalUrl: string;
  processedUrl: string;
  processing: boolean;
  done: boolean;
}

interface ImagePosition {
  x: number; // 0~1, relative position within cell
  y: number;
  scale: number;
}

const EMPTY_SLOT: SlotImage = { originalUrl: '', processedUrl: '', processing: false, done: false };
const DEFAULT_POS: ImagePosition = { x: 0.5, y: 0.5, scale: 0.6 };

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) throw new Error(`Server returned empty response (${res.status})`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server error (${res.status}): ${text.slice(0, 200)}`);
  }
}

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [name, setName] = useState('');
  const [images, setImages] = useState<SlotImage[]>([
    { ...EMPTY_SLOT }, { ...EMPTY_SLOT }, { ...EMPTY_SLOT }, { ...EMPTY_SLOT },
  ]);
  const [order, setOrder] = useState([0, 1, 2, 3]);
  const [swapSource, setSwapSource] = useState<number | null>(null);
  const [positions, setPositions] = useState<ImagePosition[]>([
    { ...DEFAULT_POS }, { ...DEFAULT_POS }, { ...DEFAULT_POS }, { ...DEFAULT_POS },
  ]);
  const [activePosition, setActivePosition] = useState(0);
  const [width] = useState(1200);
  const [height] = useState(1800);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const posDragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number; cellW: number; cellH: number } | null>(null);

  // --- Upload step ---
  const handleImageSelect = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImages(prev => {
        const next = [...prev];
        next[index] = { originalUrl: dataUrl, processedUrl: '', processing: false, done: false };
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBg = async (index: number) => {
    const img = images[index];
    if (!img.originalUrl || img.processing) return;

    setImages(prev => {
      const next = [...prev];
      next[index] = { ...next[index], processing: true };
      return next;
    });
    setError('');

    try {
      // @ts-ignore - ESM CDN에서 런타임 로드
      const { removeBackground } = await import(/* webpackIgnore: true */ 'https://esm.sh/@imgly/background-removal@1.7.0');
      const blob = await removeBackground(img.originalUrl);
      const url = URL.createObjectURL(blob);
      setImages(prev => {
        const next = [...prev];
        next[index] = { ...next[index], processedUrl: url, processing: false, done: true };
        return next;
      });
    } catch (err: any) {
      setError(`Image ${index + 1}: Background removal failed`);
      setImages(prev => {
        const next = [...prev];
        next[index] = { ...next[index], processing: false };
        return next;
      });
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => {
      const next = [...prev];
      next[index] = { ...EMPTY_SLOT };
      return next;
    });
  };

  const allUploaded = images.every(img => img.originalUrl);
  const allProcessed = images.every(img => img.done);

  const handleRemoveAllBg = async () => {
    for (let i = 0; i < 4; i++) {
      if (!images[i].done && images[i].originalUrl) {
        await handleRemoveBg(i);
      }
    }
  };

  // --- Arrange step ---
  const handleSlotClick = (position: number) => {
    if (swapSource === null) {
      setSwapSource(position);
    } else {
      if (swapSource !== position) {
        setOrder(prev => {
          const next = [...prev];
          const temp = next[swapSource];
          next[swapSource] = next[position];
          next[position] = temp;
          return next;
        });
      }
      setSwapSource(null);
    }
  };

  // --- Save step ---
  const createSlotOverlays = useCallback(async (): Promise<Blob[]> => {
    const canvas = compositeCanvasRef.current!;
    const cellW = Math.round(width / 2);
    const cellH = Math.round(height / 2);

    const loadImage = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    const blobs: Blob[] = [];
    for (let i = 0; i < 4; i++) {
      canvas.width = cellW;
      canvas.height = cellH;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, cellW, cellH);

      const imgData = images[order[i]];
      const pos = positions[i];
      const src = imgData.processedUrl || imgData.originalUrl;
      if (src) {
        const img = await loadImage(src);
        const scale = Math.min(cellW * pos.scale / img.width, cellH * pos.scale / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const drawX = pos.x * cellW - drawW / 2;
        const drawY = pos.y * cellH - drawH / 2;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      }

      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
      blobs.push(blob);
    }
    return blobs;
  }, [images, order, positions, width, height]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      let slug = name.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/(^-|-$)/g, '');
      if (!slug) slug = `person-${Date.now()}`;

      // 1. 슬롯별 오버레이 4장 생성 & 업로드
      const overlayBlobs = await createSlotOverlays();
      const overlayUrls: string[] = [];
      for (let i = 0; i < overlayBlobs.length; i++) {
        const fd = new FormData();
        fd.append('file', new File([overlayBlobs[i]], `overlay-${i}.png`, { type: 'image/png' }));
        const res = await fetch('/api/uploads/frame', { method: 'POST', body: fd });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.error || `Overlay ${i + 1} upload failed`);
        overlayUrls.push(data.url);
      }

      // 2. Upload first processed image as thumbnail
      const thumbSrc = images[order[0]].processedUrl || images[order[0]].originalUrl;
      const thumbResponse = await fetch(thumbSrc);
      const thumbBlob = await thumbResponse.blob();
      const thumbFormData = new FormData();
      thumbFormData.append('file', new File([thumbBlob], 'thumb.png', { type: 'image/png' }));
      const thumbRes = await fetch('/api/uploads/photo', { method: 'POST', body: thumbFormData });
      const thumbData = await safeJson(thumbRes);
      if (!thumbRes.ok) throw new Error(thumbData.error || 'Thumbnail upload failed');

      // 3. Create person
      const personRes = await fetch('/api/admin/person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug, thumbnailUrl: thumbData.url }),
      });
      const person = await safeJson(personRes);
      if (!personRes.ok) throw new Error(person.error || 'Failed to create person');

      // 4. Create frame (overlayUrl은 빈 값, 슬롯별로 관리)
      const frameRes = await fetch('/api/admin/frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: person.id, overlayUrl: '', width, height }),
      });
      const frame = await safeJson(frameRes);
      if (!frameRes.ok) throw new Error(frame.error || 'Failed to create frame');

      // 5. Activate frame
      await fetch(`/api/admin/frame/${frame.id}/activate`, { method: 'POST' });

      // 6. Create 4 slots with individual overlays
      const slotW = Math.round((width - 150) / 2);
      const slotH = Math.round((height - 150) / 2);
      const slots = [
        { index: 1, x: 50, y: 50, w: slotW, h: slotH, fitMode: 'cover', rotation: 0, borderRadius: 0, maskUrl: null, overlayUrl: overlayUrls[0], zIndex: 0 },
        { index: 2, x: width - 50 - slotW, y: 50, w: slotW, h: slotH, fitMode: 'cover', rotation: 0, borderRadius: 0, maskUrl: null, overlayUrl: overlayUrls[1], zIndex: 0 },
        { index: 3, x: 50, y: height - 50 - slotH, w: slotW, h: slotH, fitMode: 'cover', rotation: 0, borderRadius: 0, maskUrl: null, overlayUrl: overlayUrls[2], zIndex: 0 },
        { index: 4, x: width - 50 - slotW, y: height - 50 - slotH, w: slotW, h: slotH, fitMode: 'cover', rotation: 0, borderRadius: 0, maskUrl: null, overlayUrl: overlayUrls[3], zIndex: 0 },
      ];
      await fetch(`/api/admin/frame/${frame.id}/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots }),
      });

      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Render ---
  const stepLabels = ['Upload', 'Arrange', 'Position', 'Save'];
  const stepKeys: Step[] = ['upload', 'arrange', 'position', 'save'];
  const stepIndex = stepKeys.indexOf(step);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/" className="text-gray-400 hover:text-gray-600 transition text-sm mb-6 inline-block">
        &larr; Back
      </Link>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {stepLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              stepIndex === i ? 'bg-black text-white' :
              stepIndex > i ? 'bg-green-500 text-white' :
              'bg-gray-200 text-gray-400'
            }`}>
              {stepIndex > i ? '>' : i + 1}
            </div>
            <span className={`text-xs ${stepIndex === i ? 'text-black font-medium' : 'text-gray-400'}`}>{label}</span>
            {i < stepLabels.length - 1 && <div className="w-8 h-0.5 bg-gray-200" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {/* ========== Step 1: Upload 4 images ========== */}
      {step === 'upload' && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-1">Upload 4 Images</h1>
            <p className="text-gray-500">Upload character images, then remove backgrounds</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Character Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gojo Satoru"
              className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-black focus:border-black outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {images.map((img, i) => (
              <div key={i} className="relative">
                <p className="text-xs text-gray-400 mb-1 font-medium">Image {i + 1}</p>
                {!img.originalUrl ? (
                  <label className="block aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-black transition">
                    <span className="text-3xl text-gray-300 mb-1">+</span>
                    <span className="text-xs text-gray-400">Upload</span>
                    <input type="file" accept="image/*" onChange={(e) => handleImageSelect(i, e)} className="hidden" />
                  </label>
                ) : (
                  <div className="aspect-square rounded-xl border-2 overflow-hidden relative"
                    style={img.done ? { background: 'repeating-conic-gradient(#eee 0% 25%, white 0% 50%) 50% / 16px 16px' } : {}}>
                    <img
                      src={img.processedUrl || img.originalUrl}
                      alt={`Image ${i + 1}`}
                      className="w-full h-full object-contain"
                    />
                    {img.processing && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {img.done && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">v</span>
                      </div>
                    )}
                    {!img.processing && (
                      <button onClick={() => handleRemoveImage(i)}
                        className="absolute top-1 left-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">
                        x
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {allUploaded && !allProcessed && (
            <button
              onClick={handleRemoveAllBg}
              disabled={images.some(img => img.processing)}
              className="w-full py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-40 transition"
            >
              {images.some(img => img.processing) ? 'Processing...' : 'Remove All Backgrounds'}
            </button>
          )}

          <button
            onClick={() => setStep('arrange')}
            disabled={!allUploaded || !allProcessed || !name.trim()}
            className="w-full py-4 bg-black text-white rounded-xl font-semibold text-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Next: Arrange Order
          </button>
        </div>
      )}

      {/* ========== Step 2: Arrange order ========== */}
      {step === 'arrange' && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-1">Arrange Order</h1>
            <p className="text-gray-500">Click two images to swap their positions</p>
          </div>

          {/* Preview grid */}
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
            {order.map((imgIndex, position) => {
              const img = images[imgIndex];
              const isSelected = swapSource === position;
              return (
                <button
                  key={position}
                  onClick={() => handleSlotClick(position)}
                  className={`aspect-[3/4] rounded-xl border-2 overflow-hidden transition-all ${
                    isSelected
                      ? 'border-blue-500 ring-4 ring-blue-200 scale-95'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                  style={{ background: 'repeating-conic-gradient(#eee 0% 25%, white 0% 50%) 50% / 16px 16px' }}
                >
                  <div className="relative w-full h-full">
                    <img
                      src={img.processedUrl || img.originalUrl}
                      alt={`Position ${position + 1}`}
                      className="w-full h-full object-contain"
                    />
                    <span className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-0.5 rounded">
                      {position + 1}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {swapSource !== null && (
            <p className="text-center text-blue-500 text-sm font-medium">
              Selected position {swapSource + 1} — click another to swap
            </p>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setStep('upload'); setSwapSource(null); }}
              className="flex-1 py-4 border-2 rounded-xl font-semibold text-lg hover:bg-gray-50 transition">
              Back
            </button>
            <button
              onClick={() => setStep('position')}
              className="flex-1 py-4 bg-black text-white rounded-xl font-semibold text-lg hover:bg-gray-800 transition"
            >
              Next: Position
            </button>
          </div>
        </div>
      )}

      {/* ========== Step 3: Position cutouts ========== */}
      {step === 'position' && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-1">Position Characters</h1>
            <p className="text-gray-500">Drag to move, use slider to resize each cutout</p>
          </div>

          {/* Slot selector tabs */}
          <div className="flex gap-2 justify-center">
            {[0, 1, 2, 3].map((i) => (
              <button
                key={i}
                onClick={() => setActivePosition(i)}
                className={`w-16 h-16 rounded-lg border-2 overflow-hidden transition-all ${
                  activePosition === i ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                }`}
                style={{ background: 'repeating-conic-gradient(#eee 0% 25%, white 0% 50%) 50% / 10px 10px' }}
              >
                <img
                  src={images[order[i]].processedUrl || images[order[i]].originalUrl}
                  alt={`Slot ${i + 1}`}
                  className="w-full h-full object-contain"
                />
              </button>
            ))}
          </div>

          {/* Position editor */}
          <div className="flex flex-col items-center gap-4">
            <div
              className="relative bg-gray-100 rounded-xl overflow-hidden cursor-move select-none border-2 border-gray-200"
              style={{ width: 300, height: 300 }}
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = positions[activePosition];
                posDragRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  startPosX: pos.x,
                  startPosY: pos.y,
                  cellW: rect.width,
                  cellH: rect.height,
                };
              }}
              onMouseMove={(e) => {
                if (!posDragRef.current) return;
                const d = posDragRef.current;
                const dx = (e.clientX - d.startX) / d.cellW;
                const dy = (e.clientY - d.startY) / d.cellH;
                const newX = Math.max(0, Math.min(1, d.startPosX + dx));
                const newY = Math.max(0, Math.min(1, d.startPosY + dy));
                setPositions(prev => {
                  const next = [...prev];
                  next[activePosition] = { ...next[activePosition], x: newX, y: newY };
                  return next;
                });
              }}
              onMouseUp={() => { posDragRef.current = null; }}
              onMouseLeave={() => { posDragRef.current = null; }}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = positions[activePosition];
                posDragRef.current = {
                  startX: touch.clientX,
                  startY: touch.clientY,
                  startPosX: pos.x,
                  startPosY: pos.y,
                  cellW: rect.width,
                  cellH: rect.height,
                };
              }}
              onTouchMove={(e) => {
                if (!posDragRef.current) return;
                const touch = e.touches[0];
                const d = posDragRef.current;
                const dx = (touch.clientX - d.startX) / d.cellW;
                const dy = (touch.clientY - d.startY) / d.cellH;
                const newX = Math.max(0, Math.min(1, d.startPosX + dx));
                const newY = Math.max(0, Math.min(1, d.startPosY + dy));
                setPositions(prev => {
                  const next = [...prev];
                  next[activePosition] = { ...next[activePosition], x: newX, y: newY };
                  return next;
                });
              }}
              onTouchEnd={() => { posDragRef.current = null; }}
            >
              {/* Grid lines to show cell boundary */}
              <div className="absolute inset-0 border border-dashed border-gray-300 pointer-events-none" />
              <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-gray-300 pointer-events-none" />
              <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-gray-300 pointer-events-none" />

              {/* The cutout image */}
              {(() => {
                const pos = positions[activePosition];
                const imgData = images[order[activePosition]];
                const src = imgData.processedUrl || imgData.originalUrl;
                const size = pos.scale * 100;
                return (
                  <img
                    src={src}
                    alt="Cutout"
                    className="absolute pointer-events-none"
                    style={{
                      width: `${size}%`,
                      height: `${size}%`,
                      objectFit: 'contain',
                      left: `${pos.x * 100}%`,
                      top: `${pos.y * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    draggable={false}
                  />
                );
              })()}
            </div>

            {/* Scale slider */}
            <div className="w-72">
              <label className="block text-sm font-medium mb-1 text-center">
                Size: {Math.round(positions[activePosition].scale * 100)}%
              </label>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={positions[activePosition].scale}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setPositions(prev => {
                    const next = [...prev];
                    next[activePosition] = { ...next[activePosition], scale: val };
                    return next;
                  });
                }}
                className="w-full"
              />
            </div>

            <button
              onClick={() => {
                setPositions(prev => {
                  const next = [...prev];
                  next[activePosition] = { ...DEFAULT_POS };
                  return next;
                });
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Reset position
            </button>
          </div>

          {/* Preview all 4 cells */}
          <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
            {order.map((imgIndex, i) => {
              const pos = positions[i];
              const imgData = images[imgIndex];
              const src = imgData.processedUrl || imgData.originalUrl;
              const size = pos.scale * 100;
              return (
                <button
                  key={i}
                  onClick={() => setActivePosition(i)}
                  className={`aspect-square rounded-lg overflow-hidden relative border-2 ${
                    activePosition === i ? 'border-blue-500' : 'border-gray-200'
                  }`}
                  style={{ background: 'repeating-conic-gradient(#eee 0% 25%, white 0% 50%) 50% / 8px 8px' }}
                >
                  <img
                    src={src}
                    alt={`Position ${i + 1}`}
                    className="absolute pointer-events-none"
                    style={{
                      width: `${size}%`,
                      height: `${size}%`,
                      objectFit: 'contain',
                      left: `${pos.x * 100}%`,
                      top: `${pos.y * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                  <span className="absolute top-1 left-1 bg-black/70 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                    {i + 1}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('arrange')}
              className="flex-1 py-4 border-2 rounded-xl font-semibold text-lg hover:bg-gray-50 transition">
              Back
            </button>
            <button
              onClick={() => setStep('save')}
              className="flex-1 py-4 bg-black text-white rounded-xl font-semibold text-lg hover:bg-gray-800 transition"
            >
              Next: Save
            </button>
          </div>
        </div>
      )}

      {/* ========== Step 3: Save ========== */}
      {step === 'save' && !done && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-1">Review & Save</h1>
            <p className="text-gray-500">"{name}" — 4 images ready</p>
          </div>

          {/* Final preview */}
          <div className="bg-gray-100 rounded-2xl p-4">
            <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
              {order.map((imgIndex, i) => {
                const img = images[imgIndex];
                const pos = positions[i];
                const size = pos.scale * 100;
                return (
                  <div key={i}
                    className="aspect-square rounded-lg overflow-hidden relative"
                    style={{ background: 'repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 50% / 12px 12px' }}>
                    <img
                      src={img.processedUrl || img.originalUrl}
                      alt={`${i + 1}`}
                      className="absolute"
                      style={{
                        width: `${size}%`,
                        height: `${size}%`,
                        objectFit: 'contain',
                        left: `${pos.x * 100}%`,
                        top: `${pos.y * 100}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('position')}
              className="flex-1 py-4 border-2 rounded-xl font-semibold text-lg hover:bg-gray-50 transition">
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-4 bg-black text-white rounded-xl font-semibold text-lg hover:bg-gray-800 disabled:opacity-40 transition"
            >
              {saving ? 'Saving...' : 'Save Frame'}
            </button>
          </div>
        </div>
      )}

      {/* ========== Done ========== */}
      {done && (
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-green-600 text-3xl font-bold">OK</span>
          </div>
          <h1 className="text-2xl font-bold">Frame Created!</h1>
          <p className="text-gray-500">"{name}" is ready to use.</p>

          <div className="flex gap-3 justify-center">
            <button onClick={() => window.location.reload()}
              className="px-6 py-3 border-2 rounded-xl font-semibold hover:bg-gray-50 transition">
              Create Another
            </button>
            <button onClick={() => router.push('/persons')}
              className="px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition">
              Take Photos
            </button>
          </div>
        </div>
      )}

      {/* Hidden canvas for compositing */}
      <canvas ref={compositeCanvasRef} className="hidden" />
    </div>
  );
}

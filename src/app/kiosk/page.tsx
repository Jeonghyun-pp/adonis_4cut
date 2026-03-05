'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Person {
  id: string;
  name: string;
  slug: string;
  thumbnailUrl: string | null;
  frames: { id: string; overlayUrl: string }[];
}

type KioskStep = 'select' | 'camera' | 'preview' | 'result';

export default function KioskPage() {
  const router = useRouter();
  const [step, setStep] = useState<KioskStep>('select');
  const [persons, setPersons] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentShot, setCurrentShot] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState('');
  const [rendering, setRendering] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const INACTIVITY_TIMEOUT = 60_000;

  const resetAll = useCallback(() => {
    setStep('select');
    setSelectedPerson(null);
    setPhotos([]);
    setCurrentShot(0);
    setCountdown(null);
    setResultUrl(null);
    setJobId('');
    setRendering(false);
    setQrDataUrl(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const resetInactivity = useCallback(() => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(resetAll, INACTIVITY_TIMEOUT);
  }, [resetAll]);

  useEffect(() => {
    fetch('/api/persons').then((r) => r.ok ? r.json() : []).then(setPersons).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => resetInactivity();
    window.addEventListener('click', handler);
    window.addEventListener('touchstart', handler);
    resetInactivity();
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('touchstart', handler);
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
    };
  }, [resetInactivity]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (step === 'camera') startCamera();
    return () => {
      if (step !== 'camera') streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [step, startCamera]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.92);
  }, []);

  const takeShot = () => {
    setCountdown(3);
    let c = 3;
    const interval = setInterval(() => {
      c--;
      if (c <= 0) {
        clearInterval(interval);
        setCountdown(null);
        const dataUrl = capturePhoto();
        if (dataUrl) {
          const newPhotos = [...photos];
          newPhotos[currentShot] = dataUrl;
          setPhotos(newPhotos);
          if (currentShot < 3) {
            setCurrentShot(currentShot + 1);
          }
        }
      } else {
        setCountdown(c);
      }
    }, 1000);
  };

  const handleRender = async () => {
    if (!selectedPerson?.frames[0]) return;
    setRendering(true);
    try {
      const formData = new FormData();
      const transforms = photos.map(() => ({ scale: 1, tx: 0, ty: 0 }));
      formData.append('meta', JSON.stringify({
        frameId: selectedPerson.frames[0].id,
        transforms,
        format: 'png',
      }));

      for (let i = 0; i < 4; i++) {
        const resp = await fetch(photos[i]);
        const blob = await resp.blob();
        formData.append(`photo_${i}`, blob, `photo_${i}.jpg`);
      }

      const res = await fetch('/api/render/enqueue', { method: 'POST', body: formData });
      if (!res.ok) { setRendering(false); return; }
      const data = await res.json();

      if (data.status === 'done') {
        setJobId(data.jobId);
        setResultUrl(data.resultUrl);
        setStep('result');
        setRendering(false);
        return;
      }

      const poll = async () => {
        const r = await fetch(`/api/render/status?jobId=${data.jobId}`);
        if (!r.ok) { setRendering(false); return; }
        const d = await r.json();
        if (d.status === 'done') {
          setJobId(d.id);
          setResultUrl(d.resultUrl);
          setStep('result');
          setRendering(false);
        } else if (d.status === 'failed') {
          setRendering(false);
        } else {
          setTimeout(poll, 1000);
        }
      };
      poll();
    } catch {
      setRendering(false);
    }
  };

  useEffect(() => {
    if (step === 'result' && resultUrl && jobId) {
      const url = `${window.location.origin}/r/${jobId}`;
      import('qrcode').then((QRCode) => {
        QRCode.toDataURL(url, { width: 300, margin: 2 }).then(setQrDataUrl);
      });
    }
  }, [step, resultUrl, jobId]);

  const allDone = photos.filter(Boolean).length === 4;

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-2xl font-bold">Photobooth</h1>
        <button onClick={resetAll} className="px-4 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600">
          Start Over
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
        {/* SELECT */}
        {step === 'select' && (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-8">Choose a Theme</h2>
            <div className="grid grid-cols-2 gap-6 max-w-2xl">
              {persons.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPerson(p); setStep('camera'); }}
                  className="bg-gray-800 rounded-2xl p-6 hover:bg-gray-700 transition"
                >
                  <div className="aspect-square bg-gray-700 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                    {p.thumbnailUrl ? (
                      <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-6xl">📸</span>
                    )}
                  </div>
                  <p className="text-xl font-semibold">{p.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CAMERA */}
        {step === 'camera' && (
          <div className="text-center w-full max-w-3xl">
            <h2 className="text-3xl font-bold mb-2">{selectedPerson?.name}</h2>
            <p className="text-xl text-gray-400 mb-4">Photo {Math.min(currentShot + 1, 4)} / 4</p>

            <div className="flex gap-3 justify-center mb-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-20 h-20 rounded-lg border-2 overflow-hidden ${
                    currentShot === i ? 'border-blue-400' : photos[i] ? 'border-green-400' : 'border-gray-600'
                  }`}
                >
                  {photos[i] ? (
                    <img src={photos[i]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="flex items-center justify-center h-full text-gray-500">{i + 1}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="relative inline-block">
              <video ref={videoRef} className="w-full max-w-xl rounded-xl scale-x-[-1]" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-9xl font-bold animate-pulse">{countdown}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-center gap-4">
              <button
                onClick={takeShot}
                disabled={countdown !== null}
                className="px-12 py-4 bg-blue-600 rounded-full text-2xl font-bold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {photos[currentShot] ? 'Retake' : 'Capture'}
              </button>
              {allDone && (
                <button
                  onClick={() => { setStep('preview'); }}
                  className="px-12 py-4 bg-green-600 rounded-full text-2xl font-bold hover:bg-green-700 transition"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        )}

        {/* PREVIEW / RENDER */}
        {step === 'preview' && (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-6">Your Photos</h2>
            <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto mb-8">
              {photos.map((p, i) => (
                <img key={i} src={p} alt="" className="rounded-xl aspect-[3/4] object-cover w-full" />
              ))}
            </div>
            {rendering ? (
              <p className="text-xl text-blue-400">Creating your photo strip...</p>
            ) : (
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setStep('camera')}
                  className="px-8 py-4 bg-gray-700 rounded-full text-xl hover:bg-gray-600 transition"
                >
                  Retake
                </button>
                <button
                  onClick={handleRender}
                  className="px-8 py-4 bg-green-600 rounded-full text-xl font-bold hover:bg-green-700 transition"
                >
                  Create Photo Strip
                </button>
              </div>
            )}
          </div>
        )}

        {/* RESULT */}
        {step === 'result' && resultUrl && (
          <div className="text-center" id="print-area">
            <h2 className="text-3xl font-bold mb-6">Your Photo Strip!</h2>
            <img src={resultUrl} alt="Result" className="max-h-[60vh] mx-auto rounded-xl shadow-lg" />
            <div className="mt-6 flex flex-col items-center gap-4">
              {qrDataUrl && (
                <div>
                  <p className="text-gray-400 mb-2">Scan to download</p>
                  <img src={qrDataUrl} alt="QR" className="mx-auto rounded-lg" />
                </div>
              )}
              <div className="flex gap-4">
                <button
                  onClick={() => window.print()}
                  className="px-8 py-4 bg-purple-600 rounded-full text-xl font-bold hover:bg-purple-700 transition"
                >
                  Print
                </button>
                <button
                  onClick={resetAll}
                  className="px-8 py-4 bg-gray-700 rounded-full text-xl hover:bg-gray-600 transition"
                >
                  New Session
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

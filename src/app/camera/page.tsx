'use client';

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface PersonData {
  id: string;
  name: string;
  frames: {
    id: string;
    width: number;
    height: number;
    overlayUrl: string;
    slots: { index: number; x: number; y: number; w: number; h: number; overlayUrl?: string }[];
  }[];
}

export default function CameraPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <CameraPage />
    </Suspense>
  );
}

function CameraPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const personSlug = searchParams.get('person');
  const [person, setPerson] = useState<PersonData | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentShot, setCurrentShot] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [mirror, setMirror] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 데이터 로드
  useEffect(() => {
    if (!personSlug) return;
    fetch(`/api/persons/${personSlug}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setPerson)
      .catch(() => router.push('/persons'));
  }, [personSlug, router]);

  // 카메라 시작 - videoRef에 직접 연결
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { mediaStream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
        // videoWidth > 0 될 때까지 대기
        await new Promise<void>((resolve) => {
          const check = () => {
            if (cancelled) return;
            if (videoRef.current && videoRef.current.videoWidth > 0) { resolve(); return; }
            requestAnimationFrame(check);
          };
          requestAnimationFrame(check);
        });
        if (!cancelled) setCameraReady(true);
      } catch {
        // 카메라 사용 불가
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // 촬영
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.92);
  }, [mirror]);

  const takeShot = useCallback(() => {
    if (!cameraReady) return;
    setCountdown(3);
    let c = 3;
    const interval = setInterval(() => {
      c--;
      if (c <= 0) {
        clearInterval(interval);
        setCountdown(null);
        const dataUrl = capturePhoto();
        if (dataUrl) {
          setPhotos((prev) => { const next = [...prev]; next[currentShot] = dataUrl; return next; });
          if (currentShot < 3) setCurrentShot((p) => p + 1);
        }
      } else {
        setCountdown(c);
      }
    }, 1000);
  }, [capturePhoto, currentShot, cameraReady]);

  // 파일 업로드
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotos((prev) => { const next = [...prev]; next[currentShot] = reader.result as string; return next; });
      if (currentShot < 3) setCurrentShot((p) => p + 1);
    };
    reader.readAsDataURL(file);
  };

  const allDone = photos.filter(Boolean).length === 4;

  const goToPreview = () => {
    if (!person || !allDone) return;
    const frame = person.frames[0];
    if (!frame) return;
    sessionStorage.setItem('photobooth_photos', JSON.stringify(photos));
    sessionStorage.setItem('photobooth_frameId', frame.id);
    sessionStorage.setItem('photobooth_personSlug', personSlug || '');
    router.push('/preview');
  };

  if (!person) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  const frame = person.frames[0];
  const slots = frame?.slots || [];
  const frameW = frame?.width || 1200;
  const frameH = frame?.height || 1800;
  const currentSlot = slots.find(s => s.index === currentShot + 1);

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="text-center py-3">
        <h1 className="text-xl font-bold text-white">{person.name}</h1>
        <p className="text-gray-400 text-sm">사진 {Math.min(currentShot + 1, 4)} / 4</p>
      </div>

      {/* 숨겨진 캔버스 (촬영용) */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 메인 영역 */}
      <div className="flex-1 flex gap-4 px-4 pb-4 min-h-0">

        {/* 왼쪽: 카메라 + 오버레이 */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div
            className="relative rounded-xl overflow-hidden bg-black"
            style={{
              width: '100%',
              height: '100%',
              maxWidth: currentSlot ? `calc((100vh - 200px) * ${currentSlot.w / currentSlot.h})` : '100%',
              aspectRatio: currentSlot ? `${currentSlot.w} / ${currentSlot.h}` : 'auto',
            }}
          >
            {/* 카메라 비디오 - 항상 DOM에 존재 */}
            <video
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-cover ${mirror ? 'scale-x-[-1]' : ''}`}
              playsInline
              muted
              autoPlay
            />

            {/* 카메라 미준비 안내 */}
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-center p-8" style={{ zIndex: 5 }}>
                <div>
                  <p className="text-lg mb-2">카메라 준비 중...</p>
                  <p className="text-sm">아래 업로드 버튼으로 사진을 추가할 수도 있습니다</p>
                </div>
              </div>
            )}

            {/* 슬롯별 오버레이 */}
            {currentSlot?.overlayUrl && (
              <img
                src={currentSlot.overlayUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                style={{ zIndex: 10 }}
              />
            )}

            {/* 카운트다운 */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40" style={{ zIndex: 20 }}>
                <span className="text-[10rem] font-bold text-white drop-shadow-lg animate-pulse leading-none">
                  {countdown}
                </span>
              </div>
            )}

            {/* 현재 촬영 번호 */}
            <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold" style={{ zIndex: 15 }}>
              {currentShot + 1}번 촬영 중
            </div>
          </div>
        </div>

        {/* 오른쪽: 프레임 미리보기 */}
        {frame && (
          <div className="flex-shrink-0 flex flex-col items-center justify-center" style={{ width: '200px' }}>
            <div
              className="relative bg-white rounded-lg overflow-hidden shadow-lg w-full"
              style={{ aspectRatio: `${frameW} / ${frameH}` }}
            >
              {slots.map((slot) => {
                const idx = slot.index - 1;
                const photo = photos[idx];
                const isActive = currentShot === idx;
                return (
                  <div
                    key={slot.index}
                    onClick={() => setCurrentShot(idx)}
                    className={`absolute overflow-hidden cursor-pointer ${
                      isActive ? 'ring-2 ring-blue-500' : ''
                    }`}
                    style={{
                      left: `${(slot.x / frameW) * 100}%`,
                      top: `${(slot.y / frameH) * 100}%`,
                      width: `${(slot.w / frameW) * 100}%`,
                      height: `${(slot.h / frameH) * 100}%`,
                    }}
                  >
                    {photo ? (
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${
                        isActive ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <span className={`text-xs font-bold ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>
                          {slot.index}
                        </span>
                      </div>
                    )}
                    {slot.overlayUrl && (
                      <img
                        src={slot.overlayUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        style={{ zIndex: 5 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-gray-400 text-xs mt-2 text-center">클릭하여 슬롯 선택</p>
          </div>
        )}
      </div>

      {/* 하단 컨트롤 */}
      <div className="bg-gray-800 px-4 py-4">
        <div className="flex justify-center items-center gap-4">
          {cameraReady && (
            <>
              <button
                onClick={() => setMirror((m) => !m)}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-full hover:bg-gray-600 transition text-sm"
              >
                {mirror ? '좌우반전 ✓' : '좌우반전'}
              </button>
              <button
                onClick={takeShot}
                disabled={countdown !== null}
                className="w-16 h-16 bg-white rounded-full flex items-center justify-center hover:bg-gray-200 disabled:opacity-50 transition shadow-lg"
              >
                <div className="w-12 h-12 border-4 border-gray-800 rounded-full" />
              </button>
            </>
          )}
          <label className="px-4 py-2 bg-gray-700 text-gray-300 rounded-full hover:bg-gray-600 transition text-sm cursor-pointer">
            📁 업로드
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>

        {allDone && (
          <div className="mt-3 text-center">
            <button
              onClick={goToPreview}
              className="px-8 py-3 bg-green-600 text-white rounded-full text-lg font-semibold hover:bg-green-700 transition"
            >
              완료 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

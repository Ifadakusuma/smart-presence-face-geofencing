import { useState, useRef, useEffect } from 'react';
import { RotateCcw, Camera, ScanFace, Check } from 'lucide-react';
import { TOTAL_FOTO, INSTRUKSI_FOTO } from './faceCaptureUtils';

export default function FaceCapturePanel({
  photos,
  onPhotosChange,
  fotoKe: controlledFotoKe,
  onFotoKeChange,
  disabled = false,
}) {
  const [internalFotoKe, setInternalFotoKe] = useState(1);
  const fotoKe = controlledFotoKe !== undefined ? controlledFotoKe : internalFotoKe;
  const setFotoKe = (val) => {
    if (onFotoKeChange) onFotoKeChange(val);
    setInternalFotoKe(val);
  };
  const [cameraError, setCameraError] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const currentPhoto = photos[fotoKe - 1];

  useEffect(() => {
    let isMounted = true;

    async function initCamera() {
      try {
        setCameraError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error('Kamera gagal diakses:', err);
        if (isMounted) {
          setCameraError('Gagal mengakses kamera. Pastikan izin kamera telah diberikan di browser.');
        }
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Pastikan video selalu play dan srcObject terhubung saat retake / ganti foto
  useEffect(() => {
    if (!currentPhoto && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [currentPhoto, fotoKe]);

  const handleCapture = () => {
    if (!videoRef.current || disabled) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    const next = [...photos];
    next[fotoKe - 1] = dataUrl;
    onPhotosChange(next);

    if (fotoKe < TOTAL_FOTO) {
      setFotoKe(fotoKe + 1);
    }
  };

  const handleRetake = () => {
    if (disabled) return;
    const next = [...photos];
    next[fotoKe - 1] = null;
    onPhotosChange(next);
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md">
          Foto {fotoKe} dari {TOTAL_FOTO}
        </span>
        <span className="text-sm font-semibold text-slate-700">
          Instruksi: {INSTRUKSI_FOTO[fotoKe]}
        </span>
      </div>

      <div className="flex gap-1.5 mb-4">
        {Array.from({ length: TOTAL_FOTO }).map((_, i) => {
          const isAccessible = i === 0 || Boolean(photos[i - 1]) || Boolean(photos[i]);
          return (
            <button
              type="button"
              key={i}
              disabled={!isAccessible || disabled}
              onClick={() => setFotoKe(i + 1)}
              className={`h-2 flex-1 rounded-full transition-all ${
                photos[i]
                  ? 'bg-emerald-500 hover:bg-emerald-600 cursor-pointer'
                  : i + 1 === fotoKe
                  ? 'bg-blue-600 cursor-pointer'
                  : isAccessible
                  ? 'bg-slate-200 hover:bg-slate-300 cursor-pointer'
                  : 'bg-slate-200 opacity-40 cursor-not-allowed'
              }`}
              title={`Foto ${i + 1}: ${INSTRUKSI_FOTO[i + 1]} ${
                !isAccessible ? '(Selesaikan foto sebelumnya)' : photos[i] ? '(Diambil)' : ''
              }`}
            />
          );
        })}
      </div>

      <div className="relative border border-slate-200 rounded-lg aspect-[4/3] max-h-72 mx-auto overflow-hidden bg-slate-900 flex items-center justify-center">
        {cameraError ? (
          <div className="p-4 text-center text-rose-300 text-xs font-medium">
            {cameraError}
          </div>
        ) : (
          <>
            {/* Video SELALU di DOM agar srcObject tidak terputus saat retake */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ display: currentPhoto ? 'none' : 'block' }}
            />

            {/* Bounding Box Guide — hanya tampil saat belum ada foto */}
            {!currentPhoto && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
                <div className="border-2 border-dashed border-blue-400/80 rounded-2xl w-48 h-56 flex items-center justify-center">
                  <div className="opacity-25 text-white">
                    <ScanFace size={64} />
                  </div>
                </div>
              </div>
            )}

            {/* Preview foto yang sudah diambil */}
            {currentPhoto && (
              <div className="absolute inset-0">
                <img
                  src={currentPhoto}
                  alt={`Foto ${fotoKe}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 bg-blue-600 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow">
                  <Check size={12} />
                  Foto Diambil
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={handleRetake}
          disabled={!currentPhoto || disabled}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw size={15} />
          Retake
        </button>
        <button
          type="button"
          onClick={handleCapture}
          disabled={Boolean(currentPhoto) || Boolean(cameraError) || disabled}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Camera size={15} />
          Capture
        </button>
      </div>

      <p className="text-xs text-slate-500 text-center mt-3">
        Pastikan pencahayaan cukup dan wajah berada di dalam garis putus-putus.
      </p>
    </div>
  );
}
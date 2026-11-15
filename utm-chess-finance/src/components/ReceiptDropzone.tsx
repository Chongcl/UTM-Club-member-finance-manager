'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MAX_FILE_SIZE_BYTES, supabase } from '@/lib/supabase';
import { parseMalaysianReceipt } from '@/lib/receiptParser';
import {
  UploadCloud,
  FileText,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  Camera,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

export interface ScannedReceiptData {
  amount: number | null;
  merchant: string;
  date: string | null;
  suggestedCategory: string;
  confidence: number;
  rawText?: string;
}

export interface ReceiptDropzoneProps {
  selectedFile?: File | null;
  file?: File | null;
  userId?: string;
  onFileSelect: (file: File | null) => void;
  onUploadedUrl?: (url: string | null) => void;
  onScanComplete?: (data: ScannedReceiptData) => void;
}

/** Convert an image file (PNG/WEBP/camera photo) to a compressed .jpg File for database/storage. */
async function convertImageToJpg(file: File): Promise<File> {
  if (file.type === 'image/jpeg' && /\.jpe?g$/i.test(file.name)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 2200;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return file;
    const baseName = file.name.replace(/\.[^/.]+$/, '') || 'receipt';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Fallback base64 data URL so full receipt image can still be saved in DB if storage upload fails. */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to encode file'));
    reader.readAsDataURL(file);
  });
}

/** Upload full receipt JPG (or PDF) to Supabase Storage immediately; fall back to data URL if storage rejects. */
async function uploadReceiptJpgToSupabase(targetFile: File, userId?: string): Promise<string> {
  const isPdf = targetFile.type === 'application/pdf' || targetFile.name.toLowerCase().endsWith('.pdf');
  const ext = isPdf ? 'pdf' : 'jpg';
  const safePath = `claims/${userId || 'scans'}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('receipts').upload(safePath, targetFile, {
    contentType: isPdf ? 'application/pdf' : 'image/jpeg',
    upsert: false,
  });
  if (!error) {
    return supabase.storage.from('receipts').getPublicUrl(safePath).data.publicUrl;
  }
  return fileToDataUrl(targetFile);
}

/** Downscale + grayscale + stretch contrast: faster scan and far better accuracy on phone photos. */
async function prepareImageForOcr(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 2000;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = d[i + 1] = d[i + 2] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    const range = Math.max(1, max - min);
    for (let i = 0; i < d.length; i += 4) {
      const v = ((d[i] - min) / range) * 255;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b || file), 'image/png'));
  } catch {
    return file;
  }
}

export default function ReceiptDropzone({
  selectedFile,
  file,
  userId,
  onFileSelect,
  onUploadedUrl,
  onScanComplete,
}: ReceiptDropzoneProps) {
  const [internalFile, setInternalFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [uploadedReceiptUrl, setUploadedReceiptUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const cameraSessionRef = useRef(0);
  const uploadSessionRef = useRef(0);

  const activeFile = selectedFile !== undefined ? selectedFile : file !== undefined ? file : internalFile;

  const stopCamera = () => {
    cameraSessionRef.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      cameraSessionRef.current += 1;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!activeFile) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setPreviewUrl(null);
      setUploadedReceiptUrl(null);
      setUploadingReceipt(false);
    }
  }, [activeFile]);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.setAttribute('playsinline', 'true');
      void videoRef.current.play().catch(() => {
        /* ignore autoplay errors when muted + playsInline is set */
      });
    }
  }, [cameraOpen]);

  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const sessionId = ++cameraSessionRef.current;
    setCameraError(null);
    setErrorMsg(null);
    setFacingMode(mode);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraOpen(false);
      setCameraError('Live camera is not supported in this browser. Use Upload File or your device camera instead.');
      return;
    }

    setCameraOpen(true);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      if (cameraSessionRef.current !== sessionId) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play().catch(() => {
          /* ignore */
        });
      }
    } catch {
      if (cameraSessionRef.current === sessionId) {
        stopCamera();
        setCameraError('Could not access camera directly (permission denied or no camera available). Use Device Camera / Photo below instead.');
      }
    }
  };

  const runOcrOnFile = async (targetFile: File) => {
    if (!onScanComplete) return;
    setErrorMsg(null);

    const isPdf = targetFile.type === 'application/pdf' || targetFile.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      setErrorMsg('PDF invoices cannot be auto-read. Upload or scan a receipt photo (JPG / PNG) to auto-fill, or type the details in manually.');
      return;
    }

    setScanning(true);
    setProgress(0);
    interface OcrWorker {
      recognize: (img: Blob) => Promise<{ data: { text: string; confidence: number } }>;
      terminate: () => Promise<unknown>;
    }
    let worker: OcrWorker | null = null;
    try {
      const { createWorker } = await import('tesseract.js');
      worker = (await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
        },
      })) as unknown as OcrWorker;

      const prepared = await prepareImageForOcr(targetFile);
      const { data } = await worker.recognize(prepared);
      const parsed = parseMalaysianReceipt(data.text, data.confidence);

      if (parsed.amount === null && !parsed.merchant && !parsed.date) {
        setErrorMsg('Could not read anything useful from this image. Try a clearer, well-lit, flat photo — or fill in the details manually.');
        return;
      }

      onScanComplete({
        amount: parsed.amount,
        merchant: parsed.merchant,
        date: parsed.date,
        suggestedCategory: '',
        confidence: parsed.confidence,
        rawText: data.text,
      });

      const missing: string[] = [];
      if (parsed.amount === null) missing.push('amount');
      if (!parsed.merchant) missing.push('merchant');
      if (!parsed.date) missing.push('date');
      if (missing.length > 0) {
        setErrorMsg(`Couldn't find the ${missing.join(', ')}. Please fill ${missing.length > 1 ? 'those' : 'that'} in manually.`);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `Receipt scan failed (${err.message}). Check your internet connection, or fill in the details manually.`
          : 'Receipt scan failed. Please fill in the details manually.'
      );
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch {
          /* ignore */
        }
      }
      setScanning(false);
      setProgress(0);
    }
  };

  const uploadFileImmediately = async (finalFile: File) => {
    const uploadId = ++uploadSessionRef.current;
    setUploadingReceipt(true);
    setUploadedReceiptUrl(null);
    onUploadedUrl?.(null);
    try {
      const url = await uploadReceiptJpgToSupabase(finalFile, userId);
      if (uploadSessionRef.current !== uploadId) return;
      setUploadedReceiptUrl(url);
      onUploadedUrl?.(url);
    } catch {
      if (uploadSessionRef.current !== uploadId) return;
      onUploadedUrl?.(null);
    } finally {
      if (uploadSessionRef.current === uploadId) {
        setUploadingReceipt(false);
      }
    }
  };

  const handleFileChange = async (f: File | null, autoScan = false) => {
    setErrorMsg(null);
    setCameraError(null);
    if (!f) {
      uploadSessionRef.current += 1;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setPreviewUrl(null);
      setUploadedReceiptUrl(null);
      setUploadingReceipt(false);
      setInternalFile(null);
      onUploadedUrl?.(null);
      onFileSelect(null);
      return;
    }

    if (f.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg('File size must be under 50 MB.');
      return;
    }

    let finalFile = f;
    if (f.type.startsWith('image/')) {
      finalFile = await convertImageToJpg(f);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const nextPreview = URL.createObjectURL(finalFile);
      objectUrlRef.current = nextPreview;
      setPreviewUrl(nextPreview);
    } else {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setPreviewUrl(null);
    }

    setInternalFile(finalFile);
    onFileSelect(finalFile);

    const uploadPromise = uploadFileImmediately(finalFile);
    const ocrPromise = autoScan && onScanComplete ? runOcrOnFile(finalFile) : Promise.resolve();
    await Promise.all([uploadPromise, ocrPromise]);
  };

  const handleCaptureFromCamera = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('Camera is still warming up. Wait a second and try again.');
      return;
    }
    const maxSide = 2200;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.max(1, Math.round(video.videoWidth * scale));
    const h = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(video, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) {
      setCameraError('Could not capture photo from camera. Please try again.');
      return;
    }
    const capturedFile = new File([blob], `receipt-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
    stopCamera();
    await handleFileChange(capturedFile, true);
  };

  const handleScan = async () => {
    if (!activeFile) return;
    let targetFile = activeFile;
    if (activeFile.type.startsWith('image/')) {
      targetFile = await convertImageToJpg(activeFile);
      if (targetFile !== activeFile) {
        setInternalFile(targetFile);
        onFileSelect(targetFile);
      }
    }
    if (!uploadedReceiptUrl && !uploadingReceipt) {
      void uploadFileImmediately(targetFile);
    }
    await runOcrOnFile(targetFile);
  };

  return (
    <div className="space-y-2.5">
      {cameraOpen ? (
        <div className="rounded-2xl overflow-hidden border-2 border-emerald-500 bg-slate-950 text-white shadow-lg">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>Position full receipt inside frame</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void startCamera(facingMode === 'environment' ? 'user' : 'environment')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 cursor-pointer"
                title="Switch front / back camera"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Switch</span>
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="p-1 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white cursor-pointer"
                title="Close camera"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative bg-black flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-h-[320px] object-contain"
            />
          </div>
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                cameraInputRef.current?.click();
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 cursor-pointer"
            >
              Use Photo Picker
            </button>
            <button
              type="button"
              onClick={() => void handleCaptureFromCamera()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold cursor-pointer shadow-xs"
            >
              <Camera className="w-4 h-4" />
              <span>Capture &amp; Scan Receipt</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2.5 p-5 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 text-center">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            {activeFile ? <FileText className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
          </div>
          <div className="text-xs font-bold text-emerald-950 break-all">
            {activeFile ? activeFile.name : 'Upload Receipt / PDF or Scan Live with Camera (Max 50 MB)'}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={scanning}
              onClick={() => uploadInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-[11px] font-bold cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{activeFile ? 'Change File' : 'Upload File'}</span>
            </button>
            {onScanComplete && (
              <button
                type="button"
                disabled={scanning}
                onClick={() => void startCamera('environment')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-[11px] font-bold cursor-pointer"
                title="Open camera directly to snap receipt, save full JPG, and auto-fill details"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span>Scan Receipt</span>
              </button>
            )}
          </div>
        </div>
      )}

      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => {
          void handleFileChange(e.target.files?.[0] || null, false);
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          void handleFileChange(e.target.files?.[0] || null, true);
          e.target.value = '';
        }}
        className="hidden"
      />

      {cameraError && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{cameraError}</span>
          </div>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold cursor-pointer shrink-0"
          >
            Open Device Camera / Photo
          </button>
        </div>
      )}

      {activeFile && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700 truncate">{activeFile.name}</span>
            <div className="flex items-center gap-2 shrink-0">
              {onScanComplete && (
                <button
                  type="button"
                  disabled={scanning}
                  onClick={() => void handleScan()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 text-white font-bold text-[11px] cursor-pointer"
                  title="Reads amount, date and merchant from the receipt image"
                >
                  {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  <span>{scanning ? `Reading receipt… ${progress}%` : 'Scan Receipt'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleFileChange(null)}
                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {previewUrl && (
            <div className="rounded-lg border border-slate-200 bg-white p-1.5 flex items-center justify-center">
              <img
                src={previewUrl}
                alt="Captured full receipt"
                className="max-h-48 w-auto object-contain rounded"
              />
            </div>
          )}

          {uploadingReceipt ? (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              <span>Uploading full receipt to database...</span>
            </div>
          ) : uploadedReceiptUrl ? (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>✓ Full receipt JPG saved to database (visible to Admin)</span>
            </div>
          ) : null}
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}

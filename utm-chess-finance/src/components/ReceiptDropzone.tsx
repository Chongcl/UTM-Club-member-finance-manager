'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MAX_FILE_SIZE_BYTES, supabase } from '@/lib/supabase';
import { parseMalaysianReceipt } from '@/lib/receiptParser';
import {
  UploadCloud,
  FileText,
  X,
  ScanLine,
  Loader2,
  AlertCircle,
  Camera,
  RefreshCw,
  CheckCircle2,
  Plus,
  Layers,
} from 'lucide-react';

export interface ScannedReceiptItem {
  fileName: string;
  amount: number | null;
  merchant: string;
  date: string | null;
  confidence: number;
  rawText?: string;
}

export interface ScannedReceiptData {
  amount: number | null;
  merchant: string;
  date: string | null;
  suggestedCategory: string;
  suggestedEvent?: string | null;
  taxAmount?: number | null;
  lineItems?: { name: string; amount: number }[];
  anomalyFlags?: string[];
  scanEngine?: 'ai' | 'ocr';
  confidence: number;
  rawText?: string;
  items?: ScannedReceiptItem[];
  fileNames?: string[];
}

export interface ReceiptDropzoneProps {
  selectedFile?: File | null;
  file?: File | null;
  userId?: string;
  activeEvents?: string[];
  categories?: string[];
  onFileSelect: (file: File | null) => void;
  onUploadedUrl?: (url: string | null) => void;
  onScanComplete?: (data: ScannedReceiptData) => void;
}

/** Convert an image file (PNG/WEBP/camera photo) to a compressed .jpg File for database/storage. */
async function convertImageToJpg(file: File): Promise<File> {
  if (file.type === 'image/jpeg' && /\.jpe?g$/i.test(file.name)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    try {
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
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}

/** Stitch 1 or more receipt images vertically onto one single tall HTML5 Canvas .jpg file. */
async function stitchImagesVerticallyToJpg(files: File[]): Promise<File> {
  if (files.length === 1) return convertImageToJpg(files[0]);

  const bitmaps: { bitmap: ImageBitmap; name: string }[] = [];
  try {
    for (const f of files) {
      try {
        const bitmap = await createImageBitmap(f);
        bitmaps.push({ bitmap, name: f.name });
      } catch {
        /* skip unreadable frame */
      }
    }
    if (bitmaps.length === 0) return files[0];
    if (bitmaps.length === 1) return convertImageToJpg(files[0]);

    const baseWidth = 1400;
    const baseHeaderH = 40;
    const baseGap = 14;
    const rawHeights = bitmaps.map((item) =>
      Math.max(1, Math.round(item.bitmap.height * (baseWidth / Math.max(1, item.bitmap.width))))
    );
    const rawTotalHeight =
      rawHeights.reduce((sum, h) => sum + baseHeaderH + h, 0) +
      baseGap * Math.max(0, bitmaps.length - 1);

    const maxCanvasHeight = 16000;
    const ratio = rawTotalHeight > maxCanvasHeight ? maxCanvasHeight / rawTotalHeight : 1;

    const targetWidth = Math.max(400, Math.round(baseWidth * ratio));
    const headerH = Math.max(24, Math.round(baseHeaderH * ratio));
    const gap = Math.max(6, Math.round(baseGap * ratio));
    const drawHeights = rawHeights.map((h) => Math.max(1, Math.round(h * ratio)));
    const canvasHeight =
      drawHeights.reduce((sum, h) => sum + headerH + h, 0) +
      gap * Math.max(0, bitmaps.length - 1);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = Math.max(1, canvasHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) return files[0];

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let cursorY = 0;
    bitmaps.forEach((item, idx) => {
      // Emerald header strip clearly separating each stitched receipt
      ctx.fillStyle = '#ecfdf5';
      ctx.fillRect(0, cursorY, targetWidth, headerH);
      ctx.fillStyle = '#a7f3d0';
      ctx.fillRect(0, cursorY + headerH - 2, targetWidth, 2);
      ctx.fillStyle = '#065f46';
      const fontSize = Math.max(12, Math.round(16 * ratio));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `RECEIPT #${idx + 1} of ${bitmaps.length} • ${item.name}`,
        Math.round(18 * ratio),
        cursorY + headerH / 2
      );
      cursorY += headerH;

      const drawH = drawHeights[idx];
      ctx.drawImage(item.bitmap, 0, cursorY, targetWidth, drawH);
      cursorY += drawH;

      if (idx < bitmaps.length - 1) {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, cursorY, targetWidth, gap);
        cursorY += gap;
      }
    });

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.88)
    );
    if (!blob) return files[0];
    return new File([blob], `stitched-${bitmaps.length}-receipts-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });
  } finally {
    bitmaps.forEach((item) => {
      try {
        item.bitmap.close();
      } catch {
        /* ignore */
      }
    });
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
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanEngineBadge, setScanEngineBadge] = useState<'ocr' | null>(null);
  const [scanStatusLabel, setScanStatusLabel] = useState<string>('');
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
  const uploadModeRef = useRef<'replace' | 'append'>('replace');
  const cameraModeRef = useRef<'replace' | 'append'>('replace');
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
      setSourceFiles([]);
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

  const startCamera = async (
    mode: 'environment' | 'user' = facingMode,
    captureMode: 'replace' | 'append' = 'replace'
  ) => {
    cameraModeRef.current = captureMode;
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
      setCameraError('Live camera is not supported in this browser. Use Upload File(s) or your device camera instead.');
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

  const runOcrOnFiles = async (filesToScan: File[]) => {
    if (!onScanComplete || filesToScan.length === 0) return;
    setErrorMsg(null);

    const imageTargets = filesToScan.filter(
      (f) => !(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    );
    if (imageTargets.length === 0) {
      setErrorMsg('PDF invoices cannot be auto-read. Upload or scan a receipt photo (JPG / PNG) to auto-fill, or type the details in manually.');
      return;
    }

    setScanning(true);
    setProgress(10);
    setScanEngineBadge(null);
    setScanStatusLabel('Reading receipt...');
    interface OcrWorker {
      recognize: (img: Blob) => Promise<{ data: { text: string; confidence: number } }>;
      terminate: () => Promise<unknown>;
    }
    let worker: OcrWorker | null = null;
    const progressRef = { idx: 0 };

    try {
      const { createWorker } = await import('tesseract.js');
      worker = (await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            const pct = ((progressRef.idx + m.progress) / imageTargets.length) * 100;
            setProgress(Math.min(99, Math.round(pct)));
          }
        },
      })) as unknown as OcrWorker;

      const scannedItems: ScannedReceiptItem[] = [];
      const rawTexts: string[] = [];
      const detectedCats: string[] = [];
      const collectedFlags: string[] = [];

      for (let i = 0; i < imageTargets.length; i++) {
        progressRef.idx = i;
        const imgFile = imageTargets[i];
        const prepared = await prepareImageForOcr(imgFile);
        const { data } = await worker.recognize(prepared);
        const parsed = parseMalaysianReceipt(data.text, data.confidence);
        scannedItems.push({
          fileName: imgFile.name,
          amount: parsed.amount,
          merchant: parsed.merchant,
          date: parsed.date,
          confidence: parsed.confidence,
          rawText: data.text,
        });
        if (parsed.suggestedCategory) detectedCats.push(parsed.suggestedCategory);
        parsed.anomalyFlags.forEach((flag) => {
          if (!collectedFlags.includes(flag)) collectedFlags.push(flag);
        });
        if (data.text) rawTexts.push(data.text);
      }

      const validAmounts = scannedItems
        .map((it) => it.amount)
        .filter((amt): amt is number => amt !== null && amt > 0);
      const totalAmount =
        validAmounts.length > 0
          ? Number(validAmounts.reduce((sum, amt) => sum + amt, 0).toFixed(2))
          : null;

      const uniqueMerchants = Array.from(
        new Set(scannedItems.map((it) => it.merchant.trim()).filter(Boolean))
      ).join(', ');
      const firstDate = scannedItems.find((it) => it.date)?.date || null;
      const avgConfidence = Math.round(
        scannedItems.reduce((sum, it) => sum + it.confidence, 0) / Math.max(1, scannedItems.length)
      );

      if (totalAmount === null && !uniqueMerchants && !firstDate) {
        setErrorMsg('Could not read anything useful from the image(s). Try clearer, well-lit, flat photos — or fill in the details manually.');
        return;
      }

      setScanEngineBadge('ocr');
      onScanComplete({
        amount: totalAmount,
        merchant: uniqueMerchants,
        date: firstDate,
        suggestedCategory: detectedCats[0] || '',
        anomalyFlags: collectedFlags,
        scanEngine: 'ocr',
        confidence: avgConfidence,
        rawText: rawTexts.join('\n---\n'),
        items: scannedItems,
        fileNames: filesToScan.map((f) => f.name),
      });

      const missing: string[] = [];
      if (totalAmount === null) missing.push('amount');
      if (!uniqueMerchants) missing.push('merchant');
      if (!firstDate) missing.push('date');
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
      setScanStatusLabel('');
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

  const applySourceFiles = async (nextList: File[], autoScan: boolean) => {
    setErrorMsg(null);
    setCameraError(null);

    if (nextList.length === 0) {
      uploadSessionRef.current += 1;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setPreviewUrl(null);
      setUploadedReceiptUrl(null);
      setUploadingReceipt(false);
      setInternalFile(null);
      setSourceFiles([]);
      setScanEngineBadge(null);
      onUploadedUrl?.(null);
      onFileSelect(null);
      return;
    }

    const oversized = nextList.find((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized) {
      setErrorMsg(`"${oversized.name}" exceeds 50 MB.`);
      return;
    }

    const isPdfFile = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
    const imageFiles = nextList.filter((f) => f.type.startsWith('image/') && !isPdfFile(f));
    const pdfFiles = nextList.filter(isPdfFile);

    let effectiveSources: File[];
    let finalFile: File;

    if (imageFiles.length > 0) {
      effectiveSources = imageFiles;
      finalFile = await stitchImagesVerticallyToJpg(imageFiles);
      if (pdfFiles.length > 0) {
        setErrorMsg('PDF files cannot be stitched onto photos; kept all receipt photos in 1 stitched JPG.');
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const nextPreview = URL.createObjectURL(finalFile);
      objectUrlRef.current = nextPreview;
      setPreviewUrl(nextPreview);
    } else {
      effectiveSources = [pdfFiles[0]];
      finalFile = pdfFiles[0];
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setPreviewUrl(null);
    }

    setSourceFiles(effectiveSources);
    setInternalFile(finalFile);
    onFileSelect(finalFile);

    const uploadPromise = uploadFileImmediately(finalFile);
    const ocrPromise = autoScan && onScanComplete ? runOcrOnFiles(effectiveSources) : Promise.resolve();
    await Promise.all([uploadPromise, ocrPromise]);
  };

  const handleIncomingFiles = async (
    incoming: FileList | File[] | null,
    mode: 'replace' | 'append',
    autoScan: boolean
  ) => {
    const picked = incoming ? Array.from(incoming) : [];
    if (picked.length === 0) return;

    const currentImages = sourceFiles.filter(
      (f) => !(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    );
    const nextList = mode === 'append' ? [...currentImages, ...picked] : picked;
    await applySourceFiles(nextList, autoScan);
  };

  const handleRemoveSourceAt = async (idx: number) => {
    const next = sourceFiles.filter((_, i) => i !== idx);
    await applySourceFiles(next, false);
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
    const mode = cameraModeRef.current;
    stopCamera();
    await handleIncomingFiles([capturedFile], mode, true);
  };

  const handleScan = async () => {
    if (!activeFile) return;
    const targets = sourceFiles.length > 0 ? sourceFiles : [activeFile];
    if (targets.length === 1 && targets[0].type.startsWith('image/')) {
      const converted = await convertImageToJpg(targets[0]);
      if (converted !== activeFile && sourceFiles.length <= 1) {
        setInternalFile(converted);
        onFileSelect(converted);
      }
    }
    if (!uploadedReceiptUrl && !uploadingReceipt) {
      void uploadFileImmediately(activeFile);
    }
    await runOcrOnFiles(targets);
  };

  return (
    <div className="space-y-2.5">
      {cameraOpen ? (
        <div className="rounded-2xl overflow-hidden border-2 border-emerald-500 bg-slate-950 text-white shadow-lg">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>
                {cameraModeRef.current === 'append' && sourceFiles.length > 0
                  ? `Add receipt #${sourceFiles.length + 1} to stitched image`
                  : 'Position full receipt inside frame'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  void startCamera(
                    facingMode === 'environment' ? 'user' : 'environment',
                    cameraModeRef.current
                  )
                }
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
              <span>
                {cameraModeRef.current === 'append' && sourceFiles.length > 0
                  ? 'Capture & Stitch Receipt'
                  : 'Capture & Scan Receipt'}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2.5 p-5 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 text-center">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            {sourceFiles.length > 1 ? (
              <Layers className="w-5 h-5" />
            ) : activeFile ? (
              <FileText className="w-5 h-5" />
            ) : (
              <UploadCloud className="w-5 h-5" />
            )}
          </div>
          <div className="text-xs font-bold text-emerald-950 break-all">
            {activeFile
              ? sourceFiles.length > 1
                ? `${sourceFiles.length} receipts combined (${activeFile.name})`
                : activeFile.name
              : 'Upload or scan receipt(s)'}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={scanning}
              onClick={() => {
                uploadModeRef.current = 'replace';
                uploadInputRef.current?.click();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-[11px] font-bold cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{activeFile ? 'Replace File(s)' : 'Upload File(s)'}</span>
            </button>
            {activeFile && !(activeFile.type === 'application/pdf' || activeFile.name.toLowerCase().endsWith('.pdf')) && (
              <button
                type="button"
                disabled={scanning}
                onClick={() => {
                  uploadModeRef.current = 'append';
                  uploadInputRef.current?.click();
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100 border border-emerald-300 disabled:opacity-60 text-emerald-900 text-[11px] font-bold cursor-pointer"
                title="Add more receipt photos and stitch onto the same single JPG"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Receipt Photo</span>
              </button>
            )}
            {onScanComplete && (
              <button
                type="button"
                disabled={scanning}
                onClick={() =>
                  void startCamera(
                    'environment',
                    sourceFiles.length > 0 ? 'append' : 'replace'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-[11px] font-bold cursor-pointer"
                title="Open camera directly to snap receipt, stitch into JPG, and auto-fill details"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span>{sourceFiles.length > 0 ? '+ Snap & Add Receipt' : 'Scan Receipt'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        onChange={(e) => {
          const picked = e.target.files ? Array.from(e.target.files) : [];
          const mode = uploadModeRef.current;
          e.target.value = '';
          const shouldAutoScan = mode === 'append' || picked.length > 1;
          void handleIncomingFiles(picked, mode, shouldAutoScan);
        }}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const picked = e.target.files ? Array.from(e.target.files) : [];
          const mode = cameraModeRef.current;
          e.target.value = '';
          void handleIncomingFiles(picked, mode, true);
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
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-white/10 p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                {activeFile.name}
                {sourceFiles.length > 1 ? ` (${sourceFiles.length} receipts stacked)` : ''}
              </span>
              {scanEngineBadge && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200">
                  Local Scanner
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onScanComplete && (
                <button
                  type="button"
                  disabled={scanning}
                  onClick={() => void handleScan()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 text-white font-bold text-[11px] cursor-pointer transition"
                  title="Reads amount, date & merchant from the receipt image(s)"
                >
                  {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanLine className="w-3 h-3" />}
                  <span className="tabular-nums">
                    {scanning
                      ? `${scanStatusLabel || 'Reading receipt…'} ${progress}%`
                      : 'Auto-fill from receipt'}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => void applySourceFiles([], false)}
                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                title="Remove all receipt files"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {sourceFiles.length > 1 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {sourceFiles.map((sf, idx) => (
                <span
                  key={`${sf.name}-${idx}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100/80 border border-emerald-200 text-[10px] font-bold text-emerald-950"
                >
                  <span>
                    #{idx + 1}: {sf.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleRemoveSourceAt(idx)}
                    className="text-emerald-700 hover:text-rose-600 cursor-pointer"
                    title="Remove this photo and re-stitch"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {previewUrl && (
            <div className="rounded-lg border border-slate-200 bg-white p-1.5 flex items-center justify-center">
              <img
                src={previewUrl}
                alt="Captured receipt preview"
                className="max-h-56 w-auto object-contain rounded"
              />
            </div>
          )}

          {uploadingReceipt ? (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              <span>
                {sourceFiles.length > 1
                  ? `Uploading stitched ${sourceFiles.length}-receipt JPG as 1 file...`
                  : 'Uploading full receipt to database...'}
              </span>
            </div>
          ) : uploadedReceiptUrl ? (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                {sourceFiles.length > 1
                  ? `✓ ${sourceFiles.length} receipts combined (1 JPG saved)`
                  : '✓ Receipt saved'}
              </span>
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

'use client';

import React, { useState, useRef } from 'react';
import { MAX_FILE_SIZE_BYTES } from '@/lib/supabase';
import { parseMalaysianReceipt } from '@/lib/receiptParser';
import { UploadCloud, FileText, X, Sparkles, Loader2, AlertCircle, Camera } from 'lucide-react';

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
  onFileSelect: (file: File | null) => void;
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

/** Downscale + grayscale + stretch contrast: faster OCR and far better accuracy on phone photos. */
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
  onFileSelect,
  onScanComplete,
}: ReceiptDropzoneProps) {
  const [internalFile, setInternalFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const activeFile = selectedFile !== undefined ? selectedFile : file !== undefined ? file : internalFile;

  const runOcrOnFile = async (targetFile: File) => {
    if (!onScanComplete) return;
    setErrorMsg(null);

    const isPdf = targetFile.type === 'application/pdf' || targetFile.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      setErrorMsg('PDF invoices cannot be auto-read. Upload a photo or screenshot (JPG / PNG) to auto-fill, or type the details in manually.');
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

  const handleFileChange = async (f: File | null, autoScan = false) => {
    setErrorMsg(null);
    if (f && f.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg('File size must be under 50 MB.');
      return;
    }
    let finalFile = f;
    if (f && autoScan && f.type.startsWith('image/')) {
      finalFile = await convertImageToJpg(f);
    }
    setInternalFile(finalFile);
    onFileSelect(finalFile);
    if (finalFile && autoScan && onScanComplete) {
      void runOcrOnFile(finalFile);
    }
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
    await runOcrOnFile(targetFile);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col items-center justify-center gap-2.5 p-5 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 text-center">
        <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
          {activeFile ? <FileText className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
        </div>
        <div className="text-xs font-bold text-emerald-950 break-all">
          {activeFile ? activeFile.name : 'Upload Receipt / PDF or Scan with Camera (Max 50 MB)'}
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
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-[11px] font-bold cursor-pointer"
              title="Take a photo or select a receipt image to scan and auto-fill"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>Scan Receipt</span>
            </button>
          )}
        </div>
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => {
            handleFileChange(e.target.files?.[0] || null, false);
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
            handleFileChange(e.target.files?.[0] || null, true);
            e.target.value = '';
          }}
          className="hidden"
        />
      </div>

      {activeFile && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <span className="font-semibold text-slate-700 truncate">{activeFile.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            {onScanComplete && (
              <button
                type="button"
                disabled={scanning}
                onClick={handleScan}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 text-white font-bold text-[11px] cursor-pointer"
                title="Reads amount, date and merchant from the receipt image"
              >
                {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                <span>{scanning ? `Reading receipt… ${progress}%` : 'Scan Receipt'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleFileChange(null)}
              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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

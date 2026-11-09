'use client';

import React, { useState, useRef } from 'react';
import { MAX_FILE_SIZE_BYTES } from '@/lib/supabase';
import {
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export interface ExtractedReceiptData {
  amount?: string;
  merchantName?: string;
  date?: string;
  suggestedTitle?: string;
  rawSummary: string;
}

interface ReceiptDropzoneProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  onAiExtracted: (data: ExtractedReceiptData) => void;
}

export default function ReceiptDropzone({
  selectedFile,
  onFileSelect,
  onAiExtracted,
}: ReceiptDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanningAi, setScanningAi] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (file: File) => {
    setErrorMsg(null);
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Please upload a JPG, PNG, WEBP image or PDF receipt.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg('File size must be under 50 MB.');
      return;
    }

    onFileSelect(file);

    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const runAiReceiptScanner = async () => {
    if (!selectedFile) return;
    setScanningAi(true);
    setAiStatus('Scanning receipt text & MYR prices...');
    setErrorMsg(null);

    try {
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(selectedFile, 'eng');
      const rawText = result.data.text || '';

      const lines = rawText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 3 && /[A-Za-z]{3,}/.test(l));
      const merchantName = lines[0]
        ? lines[0].replace(/[^a-zA-Z0-9\s&.,-]/g, '').slice(0, 45)
        : 'Campus Vendor';

      const currencyRegex = /(?:RM|MYR|TOTAL|AMOUNT|CASH)[\s:]*([0-9]{1,5}\.[0-9]{2})/gi;
      const fallbackDecimalRegex = /\b([0-9]{1,4}\.[0-9]{2})\b/g;

      const matchedAmounts: number[] = [];
      let match: RegExpExecArray | null;

      while ((match = currencyRegex.exec(rawText)) !== null) {
        const val = parseFloat(match[1]);
        if (!isNaN(val) && val > 0 && val < 20000) matchedAmounts.push(val);
      }

      if (matchedAmounts.length === 0) {
        while ((match = fallbackDecimalRegex.exec(rawText)) !== null) {
          const val = parseFloat(match[1]);
          if (!isNaN(val) && val > 0 && val < 20000) matchedAmounts.push(val);
        }
      }

      const detectedAmount =
        matchedAmounts.length > 0
          ? Math.max(...matchedAmounts).toFixed(2)
          : undefined;

      const confidence = Math.round(result.data.confidence || 88);
      const summary = `AI OCR (${confidence}%) | Merchant: ${merchantName}${
        detectedAmount ? ` | RM ${detectedAmount}` : ''
      }`;

      onAiExtracted({
        amount: detectedAmount,
        merchantName,
        suggestedTitle: `Purchase from ${merchantName}`,
        rawSummary: summary,
      });

      setAiStatus(
        detectedAmount
          ? `Extracted RM ${detectedAmount} from "${merchantName}"!`
          : `Scanned "${merchantName}". Please verify amount.`
      );
    } catch {
      setErrorMsg('Could not read file automatically. Please fill fields manually.');
      setAiStatus(null);
    } finally {
      setScanningAi(false);
    }
  };

  const clearFile = () => {
    onFileSelect(null);
    setPreviewUrl(null);
    setAiStatus(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900">
          Receipt Upload *
        </label>
        <span className="text-[11px] text-emerald-700 font-medium">
          JPG, PNG, WEBP or PDF (Max 50MB)
        </span>
      </div>

      {!selectedFile ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-emerald-600 bg-emerald-100/70'
              : 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />
          <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center mx-auto mb-2">
            <UploadCloud className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-emerald-950">
            Drag &amp; drop receipt here, or <span className="underline">browse</span> (Max 50MB)
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-14 h-14 object-cover rounded-xl border border-emerald-300"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <FileText className="w-7 h-7" />
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-emerald-950 break-all">
                  {selectedFile.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB / 50 MB max
                </p>
                {previewUrl && (
                  <button
                    type="button"
                    onClick={runAiReceiptScanner}
                    disabled={scanningAi}
                    className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-700 text-white cursor-pointer disabled:opacity-60"
                  >
                    {scanningAi ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>AI Scan Receipt</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={clearFile}
              className="p-1 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {aiStatus && (
            <div className="flex items-center gap-1.5 text-xs bg-white border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{aiStatus}</span>
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-1.5 text-xs bg-red-50 text-red-700 px-3 py-2 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
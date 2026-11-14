'use client';

import React, { useState } from 'react';
import { MAX_FILE_SIZE_BYTES } from '@/lib/supabase';
import { UploadCloud, FileText, X, Sparkles, Loader2, AlertCircle } from 'lucide-react';

export interface ScannedReceiptData {
  amount: number;
  merchant: string;
  date: string;
  suggestedCategory: string;
  confidence: number;
}

export interface ReceiptDropzoneProps {
  selectedFile?: File | null;
  file?: File | null;
  onFileSelect: (file: File | null) => void;
  onScanComplete?: (data: ScannedReceiptData) => void;
}

export default function ReceiptDropzone({
  selectedFile,
  file,
  onFileSelect,
  onScanComplete,
}: ReceiptDropzoneProps) {
  const [internalFile, setInternalFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeFile = selectedFile !== undefined ? selectedFile : file !== undefined ? file : internalFile;

  const handleFileChange = (f: File | null) => {
    setErrorMsg(null);
    if (f && f.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg('File size must be under 50 MB.');
      return;
    }
    setInternalFile(f);
    onFileSelect(f);
  };

  const handleSimulateScan = () => {
    if (!activeFile || !onScanComplete) return;
    setScanning(true);
    setTimeout(() => {
      const baseName = activeFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      onScanComplete({
        amount: 25.0,
        merchant: baseName.length > 2 ? baseName : 'Campus Supplier',
        date: new Date().toISOString().split('T')[0],
        suggestedCategory: 'Program & Event Unit',
        confidence: 94,
      });
      setScanning(false);
    }, 600);
  };

  return (
    <div className="space-y-2">
      <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 transition cursor-pointer text-center">
        <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
          {activeFile ? <FileText className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
        </div>
        <div className="text-xs font-bold text-emerald-950 break-all">
          {activeFile ? activeFile.name : 'Upload Receipt or PDF Invoice (Max 50 MB)'}
        </div>
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold">
          <UploadCloud className="w-3.5 h-3.5" />
          <span>{activeFile ? 'Change Receipt File' : 'Choose Receipt File'}</span>
        </span>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
          className="hidden"
        />
      </label>

      {activeFile && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <span className="font-semibold text-slate-700 truncate">{activeFile.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            {onScanComplete && (
              <button
                type="button"
                disabled={scanning}
                onClick={handleSimulateScan}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
              >
                {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                <span>{scanning ? 'Scanning...' : 'Auto-Fill Receipt'}</span>
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
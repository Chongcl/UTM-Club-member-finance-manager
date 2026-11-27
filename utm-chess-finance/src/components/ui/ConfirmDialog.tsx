'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import ModalShell from './ModalShell';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary' | 'amber';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const badgeStyle =
    tone === 'danger'
      ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25'
      : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25';

  const confirmButtonStyle =
    tone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-500 text-white'
      : tone === 'amber'
      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
      : 'bg-emerald-600 hover:bg-emerald-500 text-white';

  return (
    <ModalShell
      open={open}
      onClose={loading ? () => {} : onCancel}
      zIndexClass="z-[90]"
      maxWidthClass="max-w-md"
      closeOnBackdrop={!loading}
      closeOnEscape={!loading}
      ariaLabel={title}
    >
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden">
        <div className="p-5 sm:p-6 flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${badgeStyle}`}
          >
            {tone === 'danger' || tone === 'amber' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : tone === 'primary' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Info className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-snug">
                {title}
              </h3>
              <button
                type="button"
                disabled={loading}
                onClick={onCancel}
                className="p-1 -mr-1 -mt-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-white/10 transition cursor-pointer disabled:opacity-40"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {description && (
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 ${confirmButtonStyle}`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

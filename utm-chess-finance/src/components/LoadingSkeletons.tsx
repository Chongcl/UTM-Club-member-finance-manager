'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface SkeletonProps {
  darkMode?: boolean;
}

export function DashboardSkeleton({ darkMode = false }: SkeletonProps) {
  const cardCls = darkMode
    ? 'bg-slate-900/75 border-white/10'
    : 'bg-white/90 border-slate-200/80';
  const pulseCls = darkMode ? 'bg-slate-700/70' : 'bg-slate-200/80';
  const pulseSoftCls = darkMode ? 'bg-slate-800/70' : 'bg-slate-100';

  return (
    <div className="space-y-6" aria-label="Loading dashboard">
      {/* Hero Hub Skeleton */}
      <div className={`rounded-3xl border p-6 shadow-xs space-y-4 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className={`h-5 w-44 rounded-lg animate-pulse ${pulseCls}`} />
          <div className={`h-8 w-28 rounded-xl animate-pulse ${pulseSoftCls}`} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className={`md:col-span-7 h-44 rounded-2xl animate-pulse ${pulseSoftCls}`} />
          <div className="md:col-span-5 space-y-3">
            <div className={`h-20 rounded-2xl animate-pulse ${pulseSoftCls}`} />
            <div className={`h-20 rounded-2xl animate-pulse ${pulseSoftCls}`} />
          </div>
        </div>
      </div>

      {/* Activities Header Skeleton */}
      <div className={`rounded-3xl border p-5 flex items-center justify-between ${cardCls}`}>
        <div className={`h-6 w-48 rounded-lg animate-pulse ${pulseCls}`} />
        <div className="flex gap-2">
          <div className={`h-9 w-24 rounded-xl animate-pulse ${pulseSoftCls}`} />
          <div className={`h-9 w-28 rounded-xl animate-pulse ${pulseCls}`} />
        </div>
      </div>

      {/* Event Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map((idx) => (
          <div key={idx} className={`rounded-3xl border p-5 space-y-3 shadow-xs ${cardCls}`}>
            <div className="flex items-center justify-between gap-2">
              <div className={`h-5 w-24 rounded-full animate-pulse ${pulseCls}`} />
              <div className={`h-5 w-16 rounded-full animate-pulse ${pulseSoftCls}`} />
            </div>
            <div className={`h-5 w-4/5 rounded-lg animate-pulse ${pulseCls}`} />
            <div className={`h-3 w-2/3 rounded animate-pulse ${pulseSoftCls}`} />
            <div className={`h-3 w-1/2 rounded animate-pulse ${pulseSoftCls}`} />
            <div className={`h-10 w-full rounded-xl animate-pulse ${pulseSoftCls}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LedgerSkeleton({ darkMode = false }: SkeletonProps) {
  const cardCls = darkMode
    ? 'bg-slate-900/80 border-white/10'
    : 'bg-white border-slate-200';
  const pulseCls = darkMode ? 'bg-slate-700/70' : 'bg-slate-200';
  const pulseSoftCls = darkMode ? 'bg-slate-800/70' : 'bg-slate-100';

  return (
    <div className={`rounded-2xl border shadow-xs overflow-hidden ${cardCls}`} aria-label="Loading finance ledger">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/40 border-b border-slate-200/40">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="p-5 space-y-2">
            <div className={`h-3 w-24 rounded animate-pulse ${pulseSoftCls}`} />
            <div className={`h-7 w-32 rounded-lg animate-pulse ${pulseCls}`} />
            <div className={`h-3 w-36 rounded animate-pulse ${pulseSoftCls}`} />
          </div>
        ))}
      </div>
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 justify-between">
          <div className={`h-8 w-56 rounded-lg animate-pulse ${pulseSoftCls}`} />
          <div className={`h-8 w-40 rounded-lg animate-pulse ${pulseCls}`} />
        </div>
        {[1, 2, 3, 4, 5].map((r) => (
          <div
            key={r}
            className={`h-12 w-full rounded-xl animate-pulse ${pulseSoftCls}`}
          />
        ))}
      </div>
    </div>
  );
}

export function ClaimsSkeleton({ darkMode = false }: SkeletonProps) {
  const cardCls = darkMode
    ? 'bg-slate-900/80 border-white/10'
    : 'bg-white/95 border-emerald-100';
  const pulseCls = darkMode ? 'bg-slate-700/70' : 'bg-slate-200';
  const pulseSoftCls = darkMode ? 'bg-slate-800/70' : 'bg-slate-100';

  return (
    <div className={`rounded-3xl border shadow-xs overflow-hidden p-5 space-y-4 ${cardCls}`} aria-label="Loading claims">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={`h-6 w-44 rounded-lg animate-pulse ${pulseCls}`} />
        <div className="flex gap-2">
          <div className={`h-8 w-28 rounded-xl animate-pulse ${pulseSoftCls}`} />
          <div className={`h-8 w-28 rounded-xl animate-pulse ${pulseCls}`} />
        </div>
      </div>
      <div className="space-y-2.5">
        {[1, 2, 3, 4].map((row) => (
          <div
            key={row}
            className={`rounded-2xl p-4 flex items-center justify-between gap-3 ${pulseSoftCls}`}
          >
            <div className="space-y-2 flex-1">
              <div className={`h-4 w-48 rounded animate-pulse ${pulseCls}`} />
              <div className={`h-3 w-32 rounded animate-pulse ${pulseCls}`} />
            </div>
            <div className={`h-7 w-20 rounded-xl animate-pulse ${pulseCls}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

interface QueryErrorCardProps {
  title?: string;
  message: string;
  onRetry: () => void;
  darkMode?: boolean;
}

export function QueryErrorCard({
  title = 'Unable to load latest data',
  message,
  onRetry,
  darkMode = false,
}: QueryErrorCardProps) {
  return (
    <div
      role="alert"
      className={`rounded-3xl border p-6 sm:p-8 text-center space-y-3 shadow-xs ${
        darkMode
          ? 'bg-slate-900/85 border-rose-500/30 text-slate-100'
          : 'bg-white border-rose-200 text-slate-900'
      }`}
    >
      <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-extrabold">{title}</h3>
      <p className={`text-xs max-w-md mx-auto leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
        {message}
      </p>
      <div className="pt-1">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Fetch</span>
        </button>
      </div>
    </div>
  );
}

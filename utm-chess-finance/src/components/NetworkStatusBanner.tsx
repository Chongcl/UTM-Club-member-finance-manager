'use client';

import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi, AlertTriangle, RefreshCw } from 'lucide-react';

interface NetworkStatusBannerProps {
  networkError: string | null;
  onRetry: () => void;
  onReconnected?: () => void;
}

export default function NetworkStatusBanner({
  networkError,
  onRetry,
  onReconnected,
}: NetworkStatusBannerProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const onReconnectedRef = useRef(onReconnected);
  onReconnectedRef.current = onReconnected;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    setIsOffline(!navigator.onLine);

    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleOffline = () => {
      if (timer) clearTimeout(timer);
      setJustReconnected(false);
      setIsOffline(true);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setJustReconnected(true);
      onReconnectedRef.current?.();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setJustReconnected(false);
      }, 3500);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline && !justReconnected && !networkError) {
    return null;
  }

  if (isOffline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full bg-amber-500 text-slate-950 border-b border-amber-600/40 px-4 py-2 text-xs font-bold shadow-xs"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              You&apos;re offline — viewing cached state. Actions will resume once reconnected.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setRetrying(true);
              Promise.resolve(onRetry()).finally(() => setRetrying(false));
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/15 hover:bg-slate-950/25 text-slate-950 text-[11px] font-bold cursor-pointer shrink-0 transition"
          >
            <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  if (justReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full bg-emerald-600 text-white border-b border-emerald-500 px-4 py-2 text-xs font-bold shadow-xs"
      >
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <Wifi className="w-4 h-4 shrink-0" />
          <span>Back online — syncing latest data...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="w-full bg-rose-600 text-white border-b border-rose-500 px-4 py-2 text-xs font-bold shadow-xs"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-200" />
          <span className="truncate">{networkError}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setRetrying(true);
            Promise.resolve(onRetry()).finally(() => setRetrying(false));
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-rose-700 hover:bg-rose-50 text-[11px] font-bold cursor-pointer shrink-0 shadow-2xs transition"
        >
          <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
          <span>Retry</span>
        </button>
      </div>
    </div>
  );
}
